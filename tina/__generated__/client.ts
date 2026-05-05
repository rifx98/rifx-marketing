import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ url: 'http://localhost:4001/graphql', token: '7e3f66ae4163da82066dca9e0c46999c7ee217cb', queries,  });
export default client;
  