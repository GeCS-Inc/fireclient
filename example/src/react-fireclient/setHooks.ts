import "firebase/firestore";
import { useState } from "react";
import { SetCollectionFql, SetFql, StaticSetFql, StaticSetCollectionFql } from ".";
import { setCollection, setDoc, updateDoc } from "./setFunctions";
import * as typeCheck from "./typeCheck";
import { assertRule, matches, assertStaticSetFql } from "./typeCheck";

// ------------------------------------------
//  Set Hooks Base
// ------------------------------------------

function useSetDocBase(
  path: string,
  query: SetFql,
  setFunction: (
    path: string,
    query: StaticSetFql,
    onWrite: () => void,
    onError: (error: any) => void,
    options?: {
      merge?: boolean;
      mergeFields?: string[];
      callback?: () => void;
    },
  ) => void,
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  // Arg typeCheck
  typeCheck.assertSetFql(query);
  assertRule([
    { key: "path", fn: typeCheck.isString },
    {
      key: "options",
      optional: true,
      fn: matches(typeCheck.mergeRule.concat(typeCheck.callbackRule)),
    },
  ])({ path, options }, "Argument");
  const [writing, setWriting] = useState(false);
  const [called, setCalled] = useState(false);
  const [error, setError] = useState(null);

  // ObjectでQueryを指定していた場合Functionに変換する
  const queryGenerator = query instanceof Function ? query : () => query;

  const writeFn = (...args: any[]) => {
    const queryObject = queryGenerator(...args);
    assertStaticSetFql(queryObject);
    setWriting(true);
    setCalled(true);
    setFunction(
      path,
      queryObject,
      () => {
        setError(null);
        setWriting(false);
        if (options?.callback !== undefined) options.callback();
      },
      err => {
        setError(err);
        setWriting(false);
      },
      options,
    );
  };
  return [writeFn, writing, called, error];
}

function useSetDocsBase(
  queries: { [key: string]: SetFql },
  setFunction: (
    path: string,
    query: StaticSetFql,
    onWrite: () => void,
    onError: (error: any) => void,
    options?: {
      merge?: boolean;
      mergeFields?: string[];
      callback?: () => void;
    },
  ) => void,
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  // Arg typeCheck
  assertRule([
    {
      key: "options",
      optional: true,
      fn: matches(typeCheck.mergeRule.concat(typeCheck.callbackRule)),
    },
  ])({ options }, "Argument");
  typeCheck.assertSetDocsFql(queries);

  const [writing, setWriting] = useState(false);
  const [called, setCalled] = useState(false);
  const [error, setError] = useState(null);

  const queryEntries = Object.entries(queries);

  const writeFn = (...args: any[]) => {
    setWriting(true);
    setCalled(true);

    Promise.all(
      queryEntries.map(
        ([path, query]) =>
          new Promise((resolve, reject) => {
            const queryGenerator = query instanceof Function ? query : () => query;
            const queryObject = queryGenerator(...args);
            assertStaticSetFql(queryObject);
            setFunction(path, queryObject, resolve, reject, options);
          }),
      ),
    )
      .then(() => {
        setError(null);
        setWriting(false);
        if (options?.callback !== undefined) options.callback();
      })
      .catch(err => {
        setError(err);
        setWriting(false);
      });
  };
  return [writeFn, writing, called, error];
}

function useSetCollectionBase(
  path: string,
  queries: SetCollectionFql,
  setFunction: (
    path: string,
    queries: StaticSetCollectionFql,
    onWrite: () => void,
    onError: (error: any) => void,
    options?: {
      merge?: boolean;
      mergeFields?: string[];
    },
  ) => void,
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  // Arg typeCheck
  typeCheck.assertSetCollectionFql(queries);
  matches([
    { key: "path", fn: typeCheck.isString },
    {
      key: "options",
      optional: true,
      fn: matches(typeCheck.mergeRule.concat(typeCheck.callbackRule)),
    },
  ])({ path, options }, "Argument");

  const [writing, setWriting] = useState(false);
  const [called, setCalled] = useState(false);
  const [error, setError] = useState(null);

  // ObjectでQueryを指定していた場合Functionに変換する
  const queryGenerators = queries.map(query => (query instanceof Function ? query : () => query));

  const writeFn = (...args: any[]) => {
    const queryObject = queryGenerators.map(queryGenerator => queryGenerator(...args));
    assertStaticSetFql(queryObject);
    setWriting(true);
    setCalled(true);
    setFunction(
      path,
      queryObject,
      () => {
        setError(null);
        setWriting(false);
        if (options?.callback !== undefined) options.callback();
      },
      err => {
        setError(err);
        setWriting(false);
      },
      options,
    );
  };
  return [writeFn, writing, called, error];
}

// ------------------------------------------
//  Set Doc Hooks
// ------------------------------------------

export function useSetDoc(
  docPath: string,
  query: SetFql,
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  return useSetDocBase(docPath, query, setDoc, options);
}
export function useUpdateDoc(
  docPath: string,
  query: SetFql,
  options?: {
    callback?: () => void;
  },
) {
  return useSetDocBase(docPath, query, updateDoc, options);
}

// ------------------------------------------
//  Set Docs Hooks
// ------------------------------------------

export function useSetDocs(
  queries: { [key: string]: SetFql },
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  return useSetDocsBase(queries, setDoc, options);
}
export function useUpdateDocs(
  queries: { [key: string]: SetFql },
  options?: {
    callback?: () => void;
  },
) {
  return useSetDocsBase(queries, updateDoc, options);
}

// ------------------------------------------
//  Set Collection Hooks
// ------------------------------------------

export function useSetCollection(
  collectionPath: string,
  query: SetCollectionFql,
  options?: {
    merge?: boolean;
    mergeFields?: string[];
    callback?: () => void;
  },
) {
  return useSetCollectionBase(collectionPath, query, setCollection, options);
}
