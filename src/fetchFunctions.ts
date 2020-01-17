import React from "react";
import { Seq, List } from "immutable";
import { firestore } from "firebase";
import * as pathlib from "path";

import { HooksId, DocId, CollectionId } from ".";
import { Where, Limit, Order, Cursor, QueryOption } from ".";
import { providerContext, unwrapContext } from "./provider";
import { assert, isArray } from "./validation";
import { Actions } from "./reducer";

function orderedFromJS(object: any): any {
  // CursorでOriginにSnapshotを指定することがある
  if (object instanceof firestore.DocumentSnapshot) {
    return object.ref.path;
  }
  // callbackなど、FunctionをOptionに渡すことがある
  if (object instanceof Function) {
    return object.toString();
  }
  if (typeof object !== "object" || object === null) {
    return object;
  } else {
    return isArray(object)
      ? Seq(object)
          .map(orderedFromJS)
          .filter((v: any) => v !== undefined)
          .toList()
      : Seq(object)
          .map(orderedFromJS)
          .filter((v: any) => v !== undefined)
          .toOrderedMap();
  }
}

export function getHashCode(obj: any): number {
  if (obj === undefined) {
    return orderedFromJS({}).hashCode();
  } else {
    return orderedFromJS(obj).hashCode();
  }
}

export function getQueryId(path: string, option: QueryOption): CollectionId {
  return getHashCode({
    path: pathlib.resolve(path),
    option,
  });
}

// for debug
function onAccess() {
  console.log("firestore accessed");
}

// Optional型のstate, dispatch, dbをunwrap

// stateにdocのデータを保存
function saveDoc(dispatch: React.Dispatch<Actions>, docId: DocId, doc: firestore.DocumentSnapshot) {
  dispatch({
    type: "setDoc",
    payload: {
      docId,
      snapshot: doc,
    },
  });
}

// state.collectionに対象のdocのIdを保存, state.docに各データを保存
function saveCollection(
  dispatch: React.Dispatch<Actions>,
  path: string,
  option: QueryOption,
  collection: firestore.DocumentSnapshot[]
) {
  collection.forEach(doc => {
    const docId = pathlib.resolve(path, doc.id);
    saveDoc(dispatch, docId, doc);
  });
  const collectionId = getQueryId(path, option);
  const docIds = List(collection.map(doc => pathlib.resolve(path, doc.id)));
  dispatch({
    type: "setCollection",
    payload: {
      collectionId,
      docIds,
    },
  });
}

// state.docにsubscribe元を登録
function connectDocToState(dispatch: React.Dispatch<Actions>, docId: DocId, uuid: HooksId) {
  dispatch({
    type: "connectDoc",
    payload: {
      docId,
      uuid,
    },
  });
}
// state.collectionと各state.docにsubscribe元を登録
function connectCollectionToState(
  dispatch: React.Dispatch<Actions>,
  collectionId: CollectionId,
  uuid: HooksId,
  docIds: List<DocId>
) {
  dispatch({
    type: "connectCollection",
    payload: {
      collectionId,
      uuid,
    },
  });
  docIds.forEach(docId => connectDocToState(dispatch, docId, uuid));
}

// state.docからsubscribe元を削除
function disconnectDocFromState(dispatch: React.Dispatch<Actions>, docId: DocId, uuid: HooksId) {
  dispatch({
    type: "disconnectDoc",
    payload: {
      docId,
      uuid,
    },
  });
}
// state.collectionと各state.docからsubscribe元を削除
function disconnectCollectionFromState(
  dispatch: React.Dispatch<Actions>,
  collectionId: CollectionId,
  uuid: HooksId,
  docIds: List<DocId>
) {
  dispatch({
    type: "disconnectCollection",
    payload: {
      collectionId,
      uuid,
    },
  });
  docIds.forEach(docId => disconnectDocFromState(dispatch, docId, uuid));
}

function withWhere(ref: firestore.Query, where: Where | [Where]): firestore.Query {
  if (isArray(where)) {
    return (where as [Where]).reduce((acc, cond) => withWhere(acc, cond), ref);
  }

  if (where === undefined) {
    return ref;
  }

  const { field, operator, value } = where as Where;

  return ref.where(field, operator, value);
}

function withLimit(ref: firestore.Query, limit: Limit): firestore.Query {
  return limit === undefined ? ref : ref.limit(limit);
}

function withOrder(ref: firestore.Query, order: Order | [Order]): firestore.Query {
  if (isArray(order)) {
    return (order as [Order]).reduce((acc, ord) => {
      return withOrder(acc, ord);
    }, ref);
  }

  if (order === undefined) {
    return ref;
  }

  const { by, direction } = order as Order;

  return direction === undefined ? ref.orderBy(by) : ref.orderBy(by, direction);
}

function withCursor(ref: firestore.Query, cursor: Cursor): firestore.Query {
  if (cursor === undefined) {
    return ref;
  }

  const { direction, origin, multipleFields } = cursor;
  const _multipleFields = multipleFields !== undefined ? multipleFields : false;
  assert(
    !_multipleFields || origin instanceof Array,
    '"origin" should be array if "multipleFields" is true.'
  );

  if (!_multipleFields) {
    switch (direction) {
      case "startAt":
        return ref.startAt(origin);
      case "startAfter":
        return ref.startAfter(origin);
      case "endAt":
        return ref.endAt(origin);
      case "endBefore":
        return ref.endBefore(origin);
      default:
        throw new Error(
          'Query cursor.direction should be any of "startAt" / "startAfter" / "endAt" / "endBefore"'
        );
    }
  } else {
    switch (direction) {
      case "startAt":
        return ref.startAt(...origin);
      case "startAfter":
        return ref.startAfter(...origin);
      case "endAt":
        return ref.endAt(...origin);
      case "endBefore":
        return ref.endBefore(...origin);
      default:
        throw new Error(
          'Query cursor.direction should be any of "startAt" / "startAfter" / "endAt" / "endBefore"'
        );
    }
  }
}

function withOption(
  ref: firestore.CollectionReference,
  { where, limit, order, cursor }: QueryOption
): firestore.Query {
  const optionFn: {
    fn: (ref: firestore.Query, option: any) => firestore.Query;
    param: Where | [Where] | Limit | Order | [Order] | Cursor | undefined;
  }[] = [
    { fn: withWhere, param: where },
    { fn: withOrder, param: order },
    { fn: withCursor, param: cursor },
    { fn: withLimit, param: limit },
  ];
  return optionFn.reduce((acc, { fn, param }): any => {
    return fn(acc, param);
  }, ref);
}

export function getDoc(
  path: string,
  onGet: (doc: firestore.DocumentSnapshot) => void,
  onError: (err: any) => void,
  acceptOutdated = false
) {
  const docId = pathlib.resolve(path);
  const { state, dispatch, firestoreDB } = unwrapContext(providerContext);

  // state内でsubscribeされているかチェック
  const cache = state.get("doc").get(docId);
  if (cache !== undefined && (acceptOutdated || cache?.get("connectedFrom")?.size > 0)) {
    onGet(cache.get("snapshot"));
    return;
  }

  const ref = firestoreDB.doc(path);
  ref
    .get()
    .then(doc => {
      onAccess(); // for debug
      saveDoc(dispatch, docId, doc);
      onGet(doc);
    })
    .catch(err => {
      // throw Error(err); // for debug
      onError(err);
    });
}

export function subscribeDoc(
  uuid: HooksId,
  path: string,
  onChange: (doc: firestore.DocumentSnapshot) => void,
  onError: (err: any) => void,
  onListen: () => void = () => {}
): () => void {
  const docId = pathlib.resolve(path);
  const { dispatch, firestoreDB } = unwrapContext(providerContext);
  const ref = firestoreDB.doc(path);

  const unsubscribe = ref.onSnapshot(
    doc => {
      onAccess(); // for debug
      onListen();
      saveDoc(dispatch, docId, doc);
      connectDocToState(dispatch, docId, uuid);
      onChange(doc);
    },
    err => {
      // throw err; // for debug
      onError(err);
    }
  );

  return () => {
    unsubscribe();
    disconnectDocFromState(dispatch, docId, uuid);
  };
}

export function getCollection(
  path: string,
  option: QueryOption = {},
  onGet: (collection: firestore.DocumentSnapshot[]) => void,
  onError: (err: any) => void,
  acceptOutdated = false
): void {
  const collectionId = getQueryId(path, option);
  const { state, dispatch, firestoreDB } = unwrapContext(providerContext);

  // state内でsubscribeされているかチェック
  const cache = state.get("collection").get(collectionId);
  if (cache !== undefined && (acceptOutdated || cache?.get("connectedFrom")?.size > 0)) {
    const docIds = cache.get("docIds").map(id => pathlib.resolve(path, id!));
    const collectionSnapshot: firestore.DocumentSnapshot[] = docIds
      .map(docId =>
        state
          .get("doc")
          .get(docId)
          .get("snapshot")
      )
      .toJS();
    onGet(collectionSnapshot);
    return;
  }

  const ref = withOption(firestoreDB.collection(path), option);
  ref
    .get()
    .then(collection => {
      onAccess(); // for debug
      saveCollection(dispatch, path, option, collection.docs);
      onGet(collection.docs);
    })
    .catch(err => {
      // throw Error(err); // for debug
      onError(err);
    });
}

export function subscribeCollection(
  uuid: HooksId,
  path: string,
  option: QueryOption = {},
  onChange: (collection: firestore.DocumentSnapshot[]) => void,
  onError: (err: any) => void,
  onListen: () => void = () => {}
): () => void {
  const collectionId = getQueryId(path, option);
  const { dispatch, firestoreDB } = unwrapContext(providerContext);

  const ref = withOption(firestoreDB.collection(path), option);

  let docIds = List<string>();
  const unsubscribe = ref.onSnapshot(
    collection => {
      onAccess(); // for debug
      onListen();
      // docIdsを更新
      // 対象から外れたdocをunsubscribeする
      const nextDocIds = List(collection.docs.map(doc => pathlib.resolve(path, doc.id)));
      const decreased = docIds.filter(id => nextDocIds.indexOf(id) === -1);
      decreased.forEach(docId => disconnectDocFromState(dispatch, docId, uuid));
      docIds = nextDocIds;

      saveCollection(dispatch, path, option, collection.docs);
      connectCollectionToState(dispatch, collectionId, uuid, docIds);
      onChange(collection.docs);
    },
    err => {
      // throw err; // for debug
      onError(err);
    }
  );

  return () => {
    unsubscribe();
    disconnectCollectionFromState(dispatch, collectionId, uuid, docIds);
  };
}
