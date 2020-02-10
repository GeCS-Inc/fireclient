import { renderHook } from "@testing-library/react-hooks";
import * as pathlib from "path";
import { setContext, useGetDoc } from "../../../dist";
import backup from "../backup1.json";
import db from "../firestore";

const testGettingDoc = path => {
  it(`should handle a simple query "${path}"`, async () => {
    const pathSplitted = pathlib
      .resolve(path)
      .split("/")
      .slice(1);
    const expected = {
      data: pathSplitted.reduce((acc, val) => acc[val], backup),
      id: pathlib.basename(path),
    };

    const { result, waitForNextUpdate } = renderHook(() => {
      setContext(db);
      return useGetDoc(path, { saveToState: false });
    });

    expect(result.current[0].id).toBeNull();
    expect(result.current[0].data).toBeNull();
    expect(result.current[1]).toBeTruthy(); // loading
    expect(result.current[2]).toBeNull(); // error
    await waitForNextUpdate();
    expect(result.current[0]).toEqual(expected);
    expect(result.current[1]).toBeFalsy(); // loading
    expect(result.current[2]).toBeNull(); // error
  });
};

describe("useGetDoc", () => {
  const docPaths = [
    "/test/array",
    "/test/boolean",
    "/test/map",
    "/test/null",
    "/test/number",
    "/test/string",
  ];
  docPaths.forEach(docPath => testGettingDoc(docPath));
});