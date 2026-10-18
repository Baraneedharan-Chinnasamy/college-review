"use client";

import type { ComponentProps } from "react";

import { Select } from "@/components/ui/field";

/** A <select> that submits its form as soon as the value changes. */
export function AutoSubmitSelect(props: ComponentProps<typeof Select>) {
  return <Select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
