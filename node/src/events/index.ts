import installVirtualEventController from "./install-virtual/controller";
import installEventController from "./install/controller";
import addMultisigController from "./multisig-created/controller";
import proposeInstallVirtualEventController from "./propose-install-virtual/controller";
import proposeInstallEventController from "./propose-install/controller";
import rejectInstallVirtualEventController from "./reject-install-virtual/controller";
import rejectInstallEventController from "./reject-install/controller";
import takeActionEventController from "./take-action/controller";

export {
  addMultisigController,
  installEventController,
  installVirtualEventController,
  proposeInstallEventController,
  proposeInstallVirtualEventController,
  takeActionEventController,
  rejectInstallEventController,
  rejectInstallVirtualEventController
};
