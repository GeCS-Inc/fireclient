import React, { useState } from "react";
import styled from "styled-components";
import { BrowserRouter, Route, Link } from "react-router-dom";

import GetDoc from "./container/GetDoc";
import GetCollection from "./container/GetCollection";
import SubscribeDoc from "./container/SubscribeDoc";
import LazyGetDoc from "./container/LazyGetDoc";
import GetSubCollection from "./container/GetSubCollection";

const PageContainer = styled.div`
  padding: 20px;
`;
const StyledInput = styled.input`
  padding: 5px;
`;
const StyledButton = styled.button`
  margin: 10px;
`;

const firebaseConfigCode = `
const firebaseConfig = {
  apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "xxxxxxxxxxxxxxxxxxxxxxx.firebaseapp.com",
  databaseURL: "https://xxxxxxxxxxxxxxxxxxxxxxx.firebaseio.com",
  projectId: "xxxxxxxxxxxxxxxxxxxxxxx",
  storageBucket: "xxxxxxxxxxxxxxxxxxxxxxx.appspot.com",
  messagingSenderId: "xxxxxxxxxxxx",
  appId: "x:xxxxxxxxxxxx:web:xxxxxxxxxxxxxxxxxxxxxx",
};
`;

const App = () => {
  const [docPathCache, setDocPathCache] = useState("");
  const [collectionPathCache, setCollectionPathCache] = useState("");
  const [docPath, setDocPath] = useState("");
  const [collectionPath, setCollectionPath] = useState("");
  const pages = [
    {
      title: "useGetDoc",
      path: "/",
      component: (docPath, collectionPath) =>
        docPath.length > 0 ? <GetDoc docPath={docPath} /> : <h2>Doc path is required.</h2>,
    },
    {
      title: "useGetCollection",
      component: (docPath, collectionPath) =>
        collectionPath.length > 0 ? (
          <GetCollection collectionPath={collectionPath} />
        ) : (
          <h2>Collection path is required.</h2>
        ),
    },
    {
      title: "useSubscribeDoc",
      component: (docPath, collectionPath) =>
        docPath.length > 0 ? <SubscribeDoc docPath={docPath} /> : <h2>Doc path is required.</h2>,
    },
    {
      title: "useLazyGetDoc",
      component: (docPath, collectionPath) =>
        docPath.length > 0 ? <LazyGetDoc docPath={docPath} /> : <h2>Doc path is required.</h2>,
    },
    {
      title: "useGetSubCollection",
      component: () => <GetSubCollection />,
    },
  ];
  return (
    <>
      <BrowserRouter>
        <h1>0. Change firebaseConfig in index.js into your Firebase config</h1>
        <pre>{firebaseConfigCode}</pre>
        <h1>1. Enter your firestore Doc or Collection Path.</h1>
        <h2>Doc Path</h2>
        <StyledInput
          type="text"
          placeholder="Doc path"
          onChange={e => setDocPathCache(e.target.value)}
        />
        <StyledButton onClick={() => setDocPath(docPathCache)}>Apply</StyledButton>
        <pre>Doc Path : {docPath}</pre>
        <h2>Collection Path</h2>
        <StyledInput
          type="text"
          placeholder="Collection path"
          onChange={e => setCollectionPathCache(e.target.value)}
        />
        <StyledButton onClick={() => setCollectionPath(collectionPathCache)}>Apply</StyledButton>
        <pre>Collection Path : {collectionPath}</pre>

        <h1>2. Select Hooks and check results 🥳</h1>

        {pages.map(page => (
          <Link to={`/${page.title}`}>
            <button>{page.title}</button>{" "}
          </Link>
        ))}

        <PageContainer>
          {pages.map(page => (
            <Route
              exact
              path={`/${page.title}`}
              render={() => page.component(docPath, collectionPath)}
            />
          ))}
        </PageContainer>
      </BrowserRouter>
    </>
  );
};

export default App;
