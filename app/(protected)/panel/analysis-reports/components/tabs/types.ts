import type { Filters } from "../../api/contract";

/** Props every report tab receives. Each tab loads its own data from the API when it becomes active. */
export interface TabProps { filters: Filters; refreshKey: number }
