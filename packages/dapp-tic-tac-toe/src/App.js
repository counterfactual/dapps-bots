import { bigNumberify, computeAddress, HDNode } from "ethers/utils";
import React, { Component } from "react";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Game from "./Game";
import RouterListener from "./RouterListener";
import Wager from "./Wager";
import Waiting from "./Waiting";
import Welcome from "./Welcome";

const { fromExtendedKey } = HDNode;

function xkeyKthAddress(xkey, k) {
  return computeAddress(xkeyKthHDNode(xkey, k).publicKey);
}

function xkeyKthHDNode(xkey, k) {
  return fromExtendedKey(xkey).derivePath(`${k}`);
}
export default class App extends Component {
  constructor(props) {
    super(props);
    const params = new URLSearchParams(window.location.search);
    const nodeProvider = new window.cf.NodeProviderEthereum();
    const cfProvider = new window.cf.Provider(nodeProvider);
    const gameInfo = {
      myName: params.get("myName") || "You",
      betAmount: params.get("betAmount") || "0.01",
      opponentName: params.get("opponentName") || "Opponent",
      appInstanceId: params.get("appInstanceId")
    };

    this.state = {
      connected: false,
      nodeProvider,
      cfProvider,
      gameInfo,
      redirectTo: null
    };

    this.connect().then(async () => {
      await this.requestUserData();
      this.waitForCounterpartyAppInstance(props);
    });
  }

  async connect() {
    await this.state.nodeProvider.connect();
  }

  appInstanceChanged(appInstance) {
    this.setState({
      appInstance: appInstance
    });
  }

  async requestUserData() {
    const userResult = await window.ethereum.send(
      "counterfactual:request:user"
    );
    const account = userResult.result;
    const balancesResult = await window.ethereum.send(
      "counterfactual:request:balances",
      [account.multisigAddress]
    );
    const freeBalance = balancesResult.result;
    const freeBalanceAddress = xkeyKthAddress(account.nodeAddress, 0);
    const myBalance = bigNumberify(freeBalance[freeBalanceAddress]);
    this.setState({
      user: account,
      balance: myBalance,
      connected: true
    });
  }

  waitForCounterpartyAppInstance(props) {
    // TODO: Bring back resumable games.
    // window.addEventListener("message", event => {
    //   if (
    //     typeof event.data === "string" &&
    //     event.data.startsWith("playground:response:appInstance")
    //   ) {
    //     const [, data] = event.data.split("|");
    //     if (data) {
    //       const { appInstance } = JSON.parse(data);
    //       this.appInstanceChanged(appInstance);
    //       this.setState({
    //         redirectTo: `/game?appInstanceId=${appInstance.id}`
    //       });
    //     }
    //   }
    // });
  }

  render() {
    return this.state.connected ? (
      <Router>
        <RouterListener>
          <Route
            exact
            path="/"
            render={props => (
              <Welcome {...props} redirectTo={this.state.redirectTo} />
            )}
          />
          <Route
            path="/wager"
            render={props => (
              <Wager
                {...props}
                gameInfo={this.state.gameInfo}
                cfProvider={this.state.cfProvider}
                user={this.state.user}
                balance={this.state.balance}
                matchmakeWith={this.state.matchmakeWith}
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
                user={this.state.user}
                intermediary={this.state.intermediary}
                onChangeAppInstance={this.appInstanceChanged.bind(this)}
              />
            )}
          />
        </RouterListener>
      </Router>
    ) : (
      <h1 className="App message">connecting....</h1>
    );
  }
}
