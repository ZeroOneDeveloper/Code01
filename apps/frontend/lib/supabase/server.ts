import { cookies } from "next/headers";

import { createCode01Client } from "./core";

export async function createClient() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return createCode01Client({ cookieHeader });
}
