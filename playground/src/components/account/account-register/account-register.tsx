import { Component, Element, Prop } from "@stencil/core";
import { RouterHistory } from "@stencil/router";

import AccountTunnel from "../../../data/account";
import NetworkTunnel from "../../../data/network";
import { UserChangeset } from "../../../types";

@Component({
  tag: "account-register",
  styleUrl: "account-register.scss",
  shadow: true
})
export class AccountRegister {
  @Element() el!: HTMLStencilElement;
  @Prop() connected: boolean = false;
  @Prop() address: string = "";
  @Prop() email: string = "";
  @Prop() username: string = "";
  @Prop() updateAccount: (e) => void = e => {};
  @Prop() history: RouterHistory = {} as RouterHistory;

  changeset: UserChangeset = {
    username: "",
    email: "",
    address: this.address
  };

  login() {
    console.log("login");
  }

  change(key, event) {
    this.changeset[key] = event.target.value;
  }

  formSubmitionHandler() {
    console.log(this.changeset);
    this.updateAccount(this.changeset);
    this.history.push("/deposit");
  }

  render() {
    if (this.address) {
      this.changeset.address = this.address;
    }

    return (
      <widget-screen>
        <div slot="header">Create a Playground account</div>

        <form-container onFormSubmitted={e => this.formSubmitionHandler()}>
          <form-input
            label="Username"
            value={this.changeset.username}
            onChange={e => this.change("username", e)}
          />
          <form-input
            label="Email address"
            value={this.changeset.email}
            onChange={e => this.change("email", e)}
          />
          <form-input
            label="Ethereum address"
            value={this.changeset.address}
            disabled={this.connected}
            onChange={
              !this.connected ? e => this.change("address", e) : () => {}
            }
          />
          <form-button onButtonPressed={e => this.formSubmitionHandler()}>
            Create account
          </form-button>
        </form-container>

        <div slot="post">
          Already have an account? <a onClick={this.login}>Login here</a>
        </div>
      </widget-screen>
    );
  }
}

AccountTunnel.injectProps(AccountRegister, [
  "address",
  "email",
  "updateAccount",
  "username"
]);

NetworkTunnel.injectProps(AccountRegister, ["connected"]);
