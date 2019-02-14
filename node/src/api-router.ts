import { Node } from "@counterfactual/types";

import {
  addChannelController,
  depositEventController,
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
  createChannelController,
  depositController,
  getAllChannelAddressesController,
  getAppInstanceController,
  getAppInstanceStateController,
  getFreeBalanceStateController,
  getInstalledAppInstancesController,
  getProposedAppInstancesController,
  installAppInstanceController,
  installVirtualAppInstanceController,
  proposeInstallAppInstanceController,
  proposeInstallVirtualAppInstanceController,
  rejectInstallController,
  takeActionController,
  uninstallController,
  uninstallVirtualController
} from "./methods";
import withdrawController from "./methods/state-channel/withdraw/controller";
import { NODE_EVENTS } from "./types";

export const methodNameToImplementation = {
  [Node.MethodName.CREATE_CHANNEL]: createChannelController,
  [Node.MethodName.DEPOSIT]: depositController,
  [Node.MethodName.GET_APP_INSTANCES]: getInstalledAppInstancesController,
  [Node.MethodName.GET_FREE_BALANCE_STATE]: getFreeBalanceStateController,
  [Node.MethodName.GET_CHANNEL_ADDRESSES]: getAllChannelAddressesController,
  [Node.MethodName
    .GET_PROPOSED_APP_INSTANCES]: getProposedAppInstancesController,
  [Node.MethodName.GET_STATE]: getAppInstanceStateController,
  [Node.MethodName.INSTALL]: installAppInstanceController,
  [Node.MethodName.INSTALL_VIRTUAL]: installVirtualAppInstanceController,
  [Node.MethodName.WITHDRAW]: withdrawController,
  [Node.MethodName
    .PROPOSE_INSTALL_VIRTUAL]: proposeInstallVirtualAppInstanceController,
  [Node.MethodName.PROPOSE_INSTALL]: proposeInstallAppInstanceController,
  [Node.MethodName.TAKE_ACTION]: takeActionController,
  [Node.MethodName.REJECT_INSTALL]: rejectInstallController,
  [Node.MethodName.GET_APP_INSTANCE_DETAILS]: getAppInstanceController,
  [Node.MethodName.UNINSTALL]: uninstallController,
  [Node.MethodName.UNINSTALL_VIRTUAL]: uninstallVirtualController
};

export const eventNameToImplementation = {
  [NODE_EVENTS.CREATE_CHANNEL]: addChannelController,
  [NODE_EVENTS.DEPOSIT_CONFIRMED]: depositEventController,
  [NODE_EVENTS.INSTALL]: installEventController,
  [NODE_EVENTS.INSTALL_VIRTUAL]: installVirtualEventController,
  [NODE_EVENTS.PROPOSE_INSTALL]: proposeInstallEventController,
  [NODE_EVENTS.PROPOSE_INSTALL_VIRTUAL]: proposeInstallVirtualEventController,
  [NODE_EVENTS.UPDATE_STATE]: takeActionEventController,
  [NODE_EVENTS.PROTOCOL_MESSAGE_EVENT]: protocolMessageEventController,
  [NODE_EVENTS.REJECT_INSTALL]: rejectInstallEventController,
  [NODE_EVENTS.REJECT_INSTALL_VIRTUAL]: rejectInstallVirtualEventController,
  // TODO: implement the rest
  [NODE_EVENTS.UNINSTALL]: () => {},
  [NODE_EVENTS.UNINSTALL_VIRTUAL]: () => {},
  [NODE_EVENTS.PROPOSE_STATE]: () => {},
  [NODE_EVENTS.REJECT_STATE]: () => {},
  [NODE_EVENTS.WITHDRAW]: () => {}
};
