import { firestore } from "firebase";
import { List, Seq } from "immutable";
import pathlib from "path";
import { CollectionId, Cursor, DocId, HooksId, Limit, Order, QueryOptions, Where } from ".";
import { CollectionData, DocData, FireclientState } from "./";
import { Actions } from "./reducer";
import { assert } from "./typeCheck";

/**
 * objをSortされたOrderedMapに変換して返す
 * objが持つkeyとvalueが一致していれば全く同じ内容を返す全単射な関数
 * @param obj
 */
function sortedFromJS(obj: any): any {
  // CursorでOriginにSnapshotを指定することがある
  if (obj instanceof firestore.DocumentSnapshot) {
    return obj.ref.path;
  }
  // callbackなど、FunctionをOptionに渡すことがある
  if (obj instanceof Function) {
    return obj.toString();
  }
  if (typeof obj !== "object" || obj === null) {
    return obj;
  } else {
    return Array.isArray(obj)
      ? Seq(obj)
          .map(sortedFromJS)
          .filter((v: any) => !!v)
          .toList()
      : Seq(obj)
          .map(sortedFromJS)
          .filter((v: any) => !!v)
          .toOrderedMap()
          .sortBy((v: any, k: any) => k);
  }
}

/**
 * 受け取ったobjのHashCodeを返す
 * objが持つkeyとvalueが一致していれば全く同じ値を返す全単射な関数
 * @param obj
 */
export const getHashCode = (obj: any): number =>
  obj ? sortedFromJS(obj).hashCode() : sortedFromJS({}).hashCode();

/**
 * CollectionのQueryに対するQueryIdを返す
 * CollectionPathとoptionsの内容が一致していれば全く同じ値を返す全単射な関数
 * @param collectionPath Fireclient上のCollectionのPath
 * @param options
 */
export const getQueryId = (collectionPath: string, options: QueryOptions = {}): CollectionId => {
  const optionsId = getHashCode(options);
  return collectionPath + `:${optionsId}`;
};

/**
 * HooksIdを生成する
 * ランダムな値を返す
 */
export const generateHooksId = (): HooksId => Math.random().toString(32).substring(2);

const findLastColonIndex = (s: string): number =>
  s.split("").reduce((acc, val, i) => (acc = val === ":" ? i : acc), -1);
/**
 * CollectionIdからPathの部分のみを抽出する
 * @param collectionId
 */
export const getCollectionPathFromId = (collectionId: CollectionId): string =>
  collectionId.slice(0, findLastColonIndex(collectionId));

export const searchCollectionId = (
  collectionPath: string,
  state: FireclientState,
): CollectionId[] =>
  Array.from(
    state
      .get("collection")
      .filter((id: CollectionId) => id.startsWith(collectionPath))
      .keys(),
  );

const withoutDot = (s: string): boolean => s !== ".";
const withoutEmpty = (s: string): boolean => s.length > 0;
const computeLevel = (acc: number, s: string): number => (s === ".." ? acc - 1 : acc + 1);

/**
 * pathがDocのPathであるかどうかを判定する
 * @param path
 */
export const isDocPath = (path: string): boolean => {
  const depth = pathlib
    .normalize(path)
    .split(pathlib.sep)
    .filter(withoutDot)
    .filter(withoutEmpty)
    .reduce(computeLevel, 0);
  return depth % 2 === 0;
};

/**
 * 取得したDocをDocDataに変換する
 * @param id DocId
 * @param fields Docの内容
 */
export const createData = (id: string, fields: { [fields: string]: any }): DocData => ({
  data: fields,
  id,
});
/**
 * Converts Firestore document snapshot into `DocData`.
 * @param {firestore.DocumentData} doc
 * @example
 * const [snapshot] = useGetDocSnapshot("/path/to/doc");
 * const docData = createDataFromDoc(snapshot);
 */
export const createDataFromDoc = (doc: firestore.DocumentData): DocData => {
  const { id } = doc;
  const data = doc.data();
  return createData(id, data ? data : null);
};
/**
 * Converts Firestore collection snapshot into `CollectionData`.
 * @param {firestore.DocumentData} doc
 * @example
 * const [snapshot] = useGetCollectionSnapshot("/path/to/collection");
 * const collectionData = createDataFromCollection(snapshot);
 */
export const createDataFromCollection = (
  collection: firestore.DocumentSnapshot[],
): CollectionData => collection.map((coll) => createDataFromDoc(coll));

/**
 * DocDataをproviderContext内のstateに保存する
 * @param dispatch
 * @param docPath
 * @param doc
 */
export const saveDoc = (dispatch: React.Dispatch<Actions>, docPath: string, doc: DocData): void =>
  dispatch({
    type: "setDoc",
    payload: {
      docId: pathlib.resolve(docPath),
      data: doc,
    },
  });

/**
 * CollectionDataをproviderContext内のstateに保存する
 * @param dispatch
 * @param collectionPath
 * @param options Collectionを取得した際のQueryOptions QueryIdの取得に使用する
 * @param collection
 */
export const saveCollection = (
  dispatch: React.Dispatch<Actions>,
  collectionPath: string,
  options: QueryOptions,
  collection: CollectionData,
): void => {
  collection.forEach((doc) => {
    if (doc.id === null) {
      return;
    }
    saveDoc(dispatch, pathlib.resolve(collectionPath, doc.id), doc);
  });
  const collectionId = getQueryId(collectionPath, options);
  const docIds = List(
    collection
      .filter((doc) => doc.id !== null)
      .map((doc) => pathlib.resolve(collectionPath, doc.id as string)),
  );
  dispatch({
    type: "setCollection",
    payload: {
      collectionId,
      docIds,
    },
  });
};

/**
 * docPathの内容をproviderContext内のstateから削除する
 * @param dispatch
 * @param docPath
 */
export const deleteDocFromState = (dispatch: React.Dispatch<Actions>, docPath: string): void =>
  dispatch({
    type: "deleteDoc",
    payload: {
      docId: pathlib.resolve(docPath),
    },
  });
/**
 * collectionPathの内容をproviderContext内のstateから削除する
 * @param dispatch
 * @param collectionPath
 */
export const deleteCollectionFromState = (
  dispatch: React.Dispatch<Actions>,
  collectionPath: string,
): void =>
  dispatch({
    type: "deleteCollection",
    payload: {
      collectionId: getQueryId(collectionPath),
    },
  });

/**
 * providerContext内のstate上で
 * docIdがhooksIdからsubscribeされていることを記憶する
 *
 * state.doc.(docId).connectedFromにhooksIdを追加する
 * @param dispatch
 * @param docId
 * @param hooksId
 */
export const connectDocToState = (
  dispatch: React.Dispatch<Actions>,
  docId: DocId,
  hooksId: HooksId,
): void =>
  dispatch({
    type: "connectDoc",
    payload: {
      docId,
      hooksId,
    },
  });

/**
 * providerContext内のstate上で
 * 各docIdとcollectionIdがhooksIdからsubscribeされていることを記憶する
 *
 * state.doc.(各docId).connectedFromと
 * state.collection.(collectionId).connectedFromにhooksIdを追加する
 * @param dispatch
 * @param collectionId
 * @param hooksId
 * @param docIds
 */
export const connectCollectionToState = (
  dispatch: React.Dispatch<Actions>,
  collectionId: CollectionId,
  hooksId: HooksId,
  docIds: List<DocId>,
): void => {
  dispatch({
    type: "connectCollection",
    payload: {
      collectionId,
      hooksId,
    },
  });
  docIds.forEach((docId) => connectDocToState(dispatch, docId, hooksId));
};

/**
 * state.doc.(docId).connectedFromからhooksIdを削除する
 * @param dispatch
 * @param docId
 * @param hooksId
 */
export const disconnectDocFromState = (
  dispatch: React.Dispatch<Actions>,
  docId: DocId,
  hooksId: HooksId,
): void =>
  dispatch({
    type: "disconnectDoc",
    payload: {
      docId,
      hooksId,
    },
  });

/**
 * state.doc.(各docId).connectedFromと
 * state.collection.(collectionId).connectedFromからhooksIdを削除する
 * @param dispatch
 * @param collectionId
 * @param hooksId
 * @param docIds
 */
export const disconnectCollectionFromState = (
  dispatch: React.Dispatch<Actions>,
  collectionId: CollectionId,
  hooksId: HooksId,
  docIds: List<DocId>,
): void => {
  dispatch({
    type: "disconnectCollection",
    payload: {
      collectionId,
      hooksId,
    },
  });
  docIds.forEach((docId) => disconnectDocFromState(dispatch, docId, hooksId));
};

function withWhere(ref: firestore.Query, where: Where | [Where]): firestore.Query {
  if (Array.isArray(where)) {
    return (where as [Where]).reduce((acc, cond) => withWhere(acc, cond), ref);
  }

  if (!where) {
    return ref;
  }

  const { field, operator, value } = where as Where;

  return ref.where(field, operator, value);
}

function withLimit(ref: firestore.Query, limit: Limit): firestore.Query {
  return limit ? ref.limit(limit) : ref;
}

function withOrder(ref: firestore.Query, order: Order | [Order]): firestore.Query {
  if (Array.isArray(order)) {
    return (order as [Order]).reduce((acc, ord) => {
      return withOrder(acc, ord);
    }, ref);
  }

  if (!order) {
    return ref;
  }

  const { by, direction } = order as Order;

  return direction ? ref.orderBy(by, direction) : ref.orderBy(by);
}

function withCursor(ref: firestore.Query, cursor: Cursor): firestore.Query {
  if (!cursor) {
    return ref;
  }

  const { direction, origin, multipleFields } = cursor;
  const _multipleFields = multipleFields ? multipleFields : false;
  assert(
    !_multipleFields || Array.isArray(origin),
    '"origin" should be array if "multipleFields" is true.',
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
          'Query cursor.direction should be any of "startAt" / "startAfter" / "endAt" / "endBefore"',
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
          'Query cursor.direction should be any of "startAt" / "startAfter" / "endAt" / "endBefore"',
        );
    }
  }
}

export function withOption(
  ref: firestore.CollectionReference,
  { where, limit, order, cursor }: QueryOptions,
): firestore.Query {
  const optionFn: {
    fn: (ref: firestore.Query, options: any) => firestore.Query;
    param: Where | Where[] | Limit | Order | Order[] | Cursor | undefined;
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
