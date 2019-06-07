// This is a copy of what was implemented on the Node's integration tests
// to provider support for a Firebase layer.
// TODO: IMPORT THIS FROM THE NODE!
import { Node } from "@counterfactual/types";

export interface FirebaseAppConfiguration {
  databaseURL: string;
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
}

/**
 * This factory exposes default implementations of the service interfaces
 * described above, using Firebase as the implementation backend.
 */
export default class FirebaseService {
  private static app: any;

  static create(configuration: FirebaseAppConfiguration) {
    if (FirebaseService.app) {
      return FirebaseService.app;
    }

    FirebaseService.app = window["firebase"].initializeApp(configuration);
  }

  static createMessagingService(
    messagingServiceKey: string
  ): Node.IMessagingService {
    return new FirebaseMessagingService(
      FirebaseService.app.database(),
      messagingServiceKey
    );
  }

  static createStoreService(storeServiceKey: string): Node.IStoreService {
    return new FirebaseStoreService(
      FirebaseService.app.database(),
      storeServiceKey
    );
  }
}

class FirebaseMessagingService implements Node.IMessagingService {
  constructor(
    private readonly firebase: any,
    private readonly messagingServerKey: string
  ) {}

  async send(to: string, msg: any) {
    await this.firebase
      .ref(`${this.messagingServerKey}/${to}/${msg.from}`)
      .set(JSON.parse(JSON.stringify(msg)));
  }

  onReceive(address: string, callback: (msg: any) => void) {
    if (!this.firebase.app) {
      console.error(
        "Cannot register a connection with an uninitialized firebase handle"
      );
      return;
    }

    const childAddedHandler = async (snapshot: any | null) => {
      if (!snapshot) {
        console.error(
          `Node with address ${address} received a "null" snapshot`
        );
        return;
      }

      const msg = snapshot.val();

      if (msg === null) {
        // We check for `msg` being not null because when the Firebase listener
        // connects, the snapshot starts with a `null` value, and on the second
        // the call it receives a value.
        // See: https://stackoverflow.com/a/37310606/2680092
        return;
      }

      if (msg.from !== snapshot.key) {
        console.error("Incorrect message received", msg);
      }

      await this.firebase
        .ref(`${this.messagingServerKey}/${address}/${msg.from}`)
        .remove();

      try {
        callback(msg);
      } catch (error) {
        console.error(
          "Encountered an error while handling message callback",
          error
        );
      }
    };

    // Cleans the message inbox upon service start
    this.firebase.ref(`${this.messagingServerKey}/${address}`).remove();

    this.firebase
      .ref(`${this.messagingServerKey}/${address}`)
      .on("child_added", childAddedHandler);
  }
}

class FirebaseStoreService implements Node.IStoreService {
  constructor(
    private readonly firebase: any,
    private readonly storeServiceKey: string
  ) {}

  async get(key: string): Promise<any> {
    let result: any;
    await this.firebase
      .ref(this.storeServiceKey)
      .child(key)
      .once("value", (snapshot: any | null) => {
        if (snapshot === null) {
          console.debug(
            `Failed to retrieve value at ${key}: received a "null" snapshot`
          );
          return;
        }
        result = snapshot.val();
      });
    return result;
  }

  async set(pairs: { key: string; value: any }[]): Promise<void> {
    const updates = {};
    for (const pair of pairs) {
      updates[pair.key] = JSON.parse(JSON.stringify(pair.value));
    }
    await this.firebase.ref(this.storeServiceKey).update(updates);
  }
}
