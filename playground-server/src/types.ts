import { Address } from "@counterfactual/types";

export type CreateAccountRequest = PlaygroundUserData & {
  signature: string;
};

export type MatchmakeRequest = {
  userAddress: Address;
};

export type MatchmakeResponseData = {
  username: string;
  peerAddress: Address;
};

export type ErrorResponse = {
  status: number;
  errorCode: ErrorCode;
  context?: Error;
};

export type StatusCodeMapping = Map<ErrorCode | "default", number>;

export enum ErrorCode {
  UsernameRequired = "username_required",
  EmailRequired = "email_required",
  AddressRequired = "address_required",
  SignatureRequired = "signature_required",
  InvalidSignature = "invalid_signature",
  AddressAlreadyRegistered = "address_already_registered",
  AppRegistryNotAvailable = "app_registry_not_available",
  UserAddressRequired = "user_address_required",
  NoUsersAvailable = "no_users_available",
  UnhandledError = "unhandled_error"
}

export type ApiResponse = {
  error?: ErrorResponse;
  ok: boolean;
  data?:
    | CreateAccountResponseData
    | GetAppsResponseData
    | MatchmakeResponseData;
};

export type CreateAccountResponseData = {
  user: PlaygroundUser;
  multisigAddress: Address;
};

export type PlaygroundAppDefinition = {
  name: string;
  slug: string;
  url: string;
  icon: string;
};

export type GetAppsResponseData = {
  apps: PlaygroundAppDefinition[];
};

export type PlaygroundUserData = {
  email: string;
  username: string;
  address: Address;
};

export type MatchmakeUserData = {
  username: string;
  address: Address;
};

export type PlaygroundUser = PlaygroundUserData & {
  id: string;
  multisigAddress: Address;
};