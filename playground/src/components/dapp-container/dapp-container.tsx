import { Component, Element, Prop } from "@stencil/core";
import { MatchResults } from "@stencil/router";
import EventEmitter from "eventemitter3";

import AppRegistryTunnel from "../../data/app-registry";
import { AppDefinition } from "../../types";

@Component({
  tag: "dapp-container",
  styleUrl: "dapp-container.scss",
  shadow: true
})
export class DappContainer {
  @Element() private element: HTMLElement | undefined;

  @Prop() match: MatchResults = {} as MatchResults;

  @Prop({ mutable: true }) url: string = "";

  @Prop() apps: AppDefinition[] = [];

  private frameWindow: Window | null = null;
  private port: MessagePort | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();
  private messageQueue: object[] = [];
  private iframe: HTMLIFrameElement = {} as HTMLIFrameElement;

  private $onMessage: (event: MessageEvent) => void = () => {};

  render() {
    return <layout-header />;
  }

  getDappUrl(): string {
    const dappSlug = this.match.params.dappName;
    const dapp = this.apps.find(app => app.slug === dappSlug);

    if (!dapp) {
      return "";
    }

    return dapp.url;
  }

  componentDidLoad(): void {
    this.eventEmitter.on("message", this.postOrQueueMessage.bind(this));
    this.url = this.getDappUrl();

    /**
     * Once the component has loaded, we store a reference of the IFRAME
     * element's window so we can bind the message relay system.
     **/
    const element = (this.element as HTMLElement).shadowRoot as ShadowRoot;
    const iframe = document.createElement("iframe");
    iframe.src = this.url;
    element.appendChild(iframe);

    this.frameWindow = iframe.contentWindow as Window;
    this.$onMessage = this.configureMessageChannel.bind(this);

    window.addEventListener("message", this.$onMessage);

    this.iframe = iframe;
  }

  componentDidUnload() {
    if (this.frameWindow) {
      this.frameWindow = null;
    }

    this.eventEmitter.off("message");

    if (this.port) {
      this.port.close();
      this.port = null;
    }

    this.iframe.remove();
  }

  /**
   * Attempts to relay a message through the MessagePort. If the port
   * isn't available, we store the message in `this.messageQueue`
   * until the port is available.
   *
   * @param message {any}
   */
  public postOrQueueMessage(message: any): void {
    if (this.port) {
      this.port.postMessage(message);
    } else {
      this.queueMessage(message);
    }
  }

  /**
   * Binds the port with the MessageChannel created for this dApp
   * by responding to NodeProvider configuration messages.
   *
   * @param event {MessageEvent}
   */
  private configureMessageChannel(event: MessageEvent): void {
    if (!this.frameWindow) {
      return;
    }

    if (event.data === "cf-node-provider:init") {
      const { port2 } = this.configureMessagePorts();
      this.frameWindow.postMessage("cf-node-provider:port", "*", [port2]);
    }

    if (event.data === "cf-node-provider:ready") {
      this.flushMessageQueue();
      window.removeEventListener("message", this.$onMessage);
    }
  }

  /**
   * Binds this end of the MessageChannel (aka `port1`) to the dApp
   * container, and attachs a listener to relay messages via the
   * EventEmitter.
   */
  private configureMessagePorts(): MessageChannel {
    const channel = new MessageChannel();

    this.port = channel.port1;
    this.port.addEventListener("message", this.relayMessage.bind(this));
    this.port.start();

    return channel;
  }

  /**
   * Echoes a message received via PostMessage through
   * the EventEmitter.
   *
   * @param event {MessageEvent}
   */
  private relayMessage(event: MessageEvent): void {
    this.eventEmitter.emit("message", event.data);
  }

  /**
   * Echoes a message received via PostMessage through
   * the EventEmitter.
   *
   * @param event {MessageEvent}
   */
  private queueMessage(message): void {
    this.messageQueue.push(message);
  }

  /**
   * Clears the message queue and forwards any messages
   * stored there through the MessagePort.
   */
  private flushMessageQueue(): void {
    if (!this.port) {
      return;
    }

    let message;
    while ((message = this.messageQueue.shift())) {
      this.port.postMessage(message);
    }
  }
}

AppRegistryTunnel.injectProps(DappContainer, ["apps"]);
