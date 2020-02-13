import { firestore } from "firebase";
import { CollectionData, DocData, HooksId, QueryOptions } from ".";
export declare function getDocSnapshot(
  path: string,
  onGet: (doc: firestore.DocumentSnapshot) => void,
  onError: (err: Error) => void,
  saveToState?: boolean,
): void;
export declare function getDoc(
  path: string,
  onGet: (doc: DocData) => void,
  onError: (err: Error) => void,
  saveToState?: boolean,
  acceptOutdated?: boolean,
): void;
export declare function subscribeDocSnapshot(
  uuid: HooksId,
  path: string,
  onChange: (doc: firestore.DocumentSnapshot) => void,
  onError: (err: Error) => void,
  onListen?: () => void,
  saveToState?: boolean,
): () => void;
export declare function subscribeDoc(
  uuid: HooksId,
  path: string,
  onChange: (doc: DocData) => void,
  onError: (err: Error) => void,
  onListen?: () => void,
  saveToState?: boolean,
): () => void;
export declare function getCollectionSnapshot(
  path: string,
  onGet: (collection: firestore.DocumentSnapshot[]) => void,
  onError: (err: Error) => void,
  options?: QueryOptions,
  saveToState?: boolean,
): void;
export declare function getCollection(
  path: string,
  onGet: (collection: CollectionData) => void,
  onError: (err: Error) => void,
  options?: QueryOptions,
  saveToState?: boolean,
  acceptOutdated?: boolean,
): void;
export declare function subscribeCollectionSnapshot(
  uuid: HooksId,
  path: string,
  onChange: (collection: firestore.DocumentSnapshot[]) => void,
  onError: (err: Error) => void,
  onListen?: () => void,
  options?: QueryOptions,
  saveToState?: boolean,
): () => void;
export declare function subscribeCollection(
  uuid: HooksId,
  path: string,
  onChange: (collection: CollectionData) => void,
  onError: (err: Error) => void,
  onListen?: () => void,
  options?: QueryOptions,
  saveToState?: boolean,
): () => void;
