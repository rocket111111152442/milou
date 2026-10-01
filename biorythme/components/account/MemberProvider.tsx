"use client";

import { createContext, useContext, useState } from "react";
import type { Member } from "@/lib/member-auth";

type Ctx = { member: Member | null; setMember: (m: Member | null) => void };

const MemberContext = createContext<Ctx>({ member: null, setMember: () => {} });

export function MemberProvider({ initial, children }: { initial: Member | null; children: React.ReactNode }) {
  const [member, setMember] = useState(initial);
  return <MemberContext.Provider value={{ member, setMember }}>{children}</MemberContext.Provider>;
}

export const useMember = () => useContext(MemberContext);
