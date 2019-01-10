import React, { Component } from "react";
import Welcome from "./Welcome";
import Wager from "./Wager";
import Waiting from "./Waiting";
import Game from "./Game";
import { BrowserRouter as Router, Route } from "react-router-dom";
import MockNodeProvider from "./MockNodeProvider";

export default class App extends Component {
  constructor(props) {
    super(props);
    const params = new URLSearchParams(window.location.search);
    const nodeProvider = params.get("standalone")
      ? new MockNodeProvider()
      : new window.NodeProvider();
    const cfProvider = new window.cf.Provider(nodeProvider);
    const gameInfo = {
      myName: params.get("myName") || "Bob",
      betAmount: params.get("betAmount") || "0.1",
      opponentName: params.get("opponentName") || "Alice",
      appInstanceId: params.get("appInstanceId")
    };

    this.state = {
      connected: false,
      nodeProvider,
      cfProvider,
      gameInfo
    };

    this.connect(nodeProvider);
  }

  async connect() {
    await this.state.nodeProvider.connect();

    this.setState({
      connected: true
    });
  }

  appInstanceChanged(appInstance) {
    this.setState({
      appInstance: appInstance
    });
  }

  render() {
    return this.state.connected ? (
      <Router>
        <div className="App">
          <Route exact path="/" component={Welcome} />
          <Route
            path="/wager"
            render={props => (
              <Wager
                {...props}
                gameInfo={this.state.gameInfo}
                cfProvider={this.state.cfProvider}
                onChangeAppInstance={this.appInstanceChanged.bind(this)}
              />
            )}
          />
          <Route
            path="/waiting"
            render={props => (
              <Waiting
                {...props}
                cfProvider={this.state.cfProvider}
                gameInfo={this.state.gameInfo}
              />
            )}
          />
          <Route
            path="/game"
            render={props => (
              <Game
                {...props}
                cfProvider={this.state.cfProvider}
                appInstance={this.state.appInstance}
                gameInfo={this.state.gameInfo}
                onChangeAppInstance={this.appInstanceChanged.bind(this)}
              />
            )}
          />
        </div>
      </Router>
    ) : (
      <h1 className="App message">connecting....</h1>
    );
  }
}
