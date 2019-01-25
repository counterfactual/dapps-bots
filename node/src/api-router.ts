import { Node } from "@counterfactual/types";

import {
  addMultisigController,
  installEventController,
  installVirtualEventController,
  proposeInstallEventController,
  proposeInstallVirtualEventController,
  rejectInstallEventController,
  rejectInstallVirtualEventController,
  takeActionEventController
} from "./events";
import protocolMessageEventController from "./events/protocol-message/controller";
import {
  createMultisigController,
  getAllChannelAddressesController,
  getAppInstanceController,
  getAppInstanceStateController,
  getInstalledAppInstancesController,
  getProposedAppInstancesController,
  installAppInstanceController,
  installVirtualAppInstanceController,
  proposeInstallAppInstanceController,
  proposeInstallVirtualAppInstanceController,
  rejectInstallController,
  takeActionController
} from "./methods";
import { NODE_EVENTS } from "./types";

export const methodNameToImplementation = {
  [Node.MethodName.CREATE_MULTISIG]: createMultisigController,
  [Node.MethodName.GET_APP_INSTANCES]: getInstalledAppInstancesController,
  [Node.MethodName.GET_CHANNEL_ADDRESSES]: getAllChannelAddressesController,
  [Node.MethodName
    .GET_PROPOSED_APP_INSTANCES]: getProposedAppInstancesController,
  [Node.MethodName.GET_STATE]: getAppInstanceStateController,
  [Node.MethodName.INSTALL]: installAppInstanceController,
  [Node.MethodName.INSTALL_VIRTUAL]: installVirtualAppInstanceController,
  [Node.MethodName
    .PROPOSE_INSTALL_VIRTUAL]: proposeInstallVirtualAppInstanceController,
  [Node.MethodName.PROPOSE_INSTALL]: proposeInstallAppInstanceController,
  [Node.MethodName.TAKE_ACTION]: takeActionController,
  [Node.MethodName.REJECT_INSTALL]: rejectInstallController,
  [Node.MethodName.GET_APP_INSTANCE_DETAILS]: getAppInstanceController
};

export const eventNameToImplementation = {
  [NODE_EVENTS.CREATE_MULTISIG]: addMultisigController,
  [NODE_EVENTS.INSTALL]: installEventController,
  [NODE_EVENTS.INSTALL_VIRTUAL]: installVirtualEventController,
  [NODE_EVENTS.PROPOSE_INSTALL]: proposeInstallEventController,
  [NODE_EVENTS.PROPOSE_INSTALL_VIRTUAL]: proposeInstallVirtualEventController,
  [NODE_EVENTS.UPDATE_STATE]: takeActionEventController,
  [NODE_EVENTS.PROTOCOL_MESSAGE_EVENT]: protocolMessageEventController,
  [NODE_EVENTS.REJECT_INSTALL]: rejectInstallEventController,
  [NODE_EVENTS.REJECT_INSTALL_VIRTUAL]: rejectInstallVirtualEventController,
  // TODO: implement the rest
  [NODE_EVENTS.PROPOSE_STATE]: () => {},
  [NODE_EVENTS.REJECT_STATE]: () => {},
  [NODE_EVENTS.UNINSTALL]: () => {}
};
