import { Component, Element, Prop, State } from "@stencil/core";

import AppRegistryTunnel from "../../../../data/app-registry";
import PlaygroundAPIClient from "../../../../data/playground-api-client";
import { AppDefinition, UserSession } from "../../../../types";

const KOVAN_NETWORK_ID = "42";

@Component({
  tag: "dialog-propose-install",
  shadow: true
})
export class DialogProposeInstall {
  @Element() el: HTMLStencilElement = {} as HTMLStencilElement;
  @Prop() message: any;
  @Prop() onAccept: (message: any) => void = () => {};
  @Prop() onReject: () => void = () => {};
  @Prop() apps: AppDefinition[] = [];

  @State() user: UserSession = {} as UserSession;

  async componentWillLoad() {
    if (this.message.data) {
      this.user = await PlaygroundAPIClient.getUserByNodeAddress(
        this.message.data.proposedByIdentifier
      );
    }
  }

  render() {
    const app = this.apps.find(app => {
      return (
        app.id[KOVAN_NETWORK_ID] === this.message.data.params.appDefinition
      );
    });

    if (!app) {
      throw Error(
        "You've received an installation proposal from a different Ethereum network"
      );
    }
    return (
      <widget-dialog
        visible={true}
        dialogTitle="You've been invited to play!"
        content={
          <label>
            You'll need to deposit
            <br />
            <strong>
              {window["ethers"].utils.formatEther(
                this.message.data.params.myDeposit
              )}{" "}
              ETH
            </strong>{" "}
            to play <strong>{app.name}</strong> with{" "}
            <strong>{this.user.username}</strong>.
          </label>
        }
        primaryButtonText="Accept"
        onPrimaryButtonClicked={() => this.onAccept(this.message)}
        secondaryButtonText="Reject"
        onSecondaryButtonClicked={() => this.onReject()}
      />
    );
  }
}

AppRegistryTunnel.injectProps(DialogProposeInstall, ["apps"]);
