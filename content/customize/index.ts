import type { ComponentType } from "react";
import type { Sheet } from "@/lib/types";
import { AbTesting } from "./abtesting";
import { Clustering } from "./clustering";
import { DataEngineeringPatterns } from "./depatterns";
import { FeatureEngineering } from "./featureeng";
import { MathStats } from "./mathstats";

export type CustomizedComponentProps = {
  item: Sheet;
  body: string | null;
};

export const CUSTOMIZED_COMPONENTS: Record<
  string,
  ComponentType<CustomizedComponentProps>
> = {
  abtesting: AbTesting,
  clustering: Clustering,
  depatterns: DataEngineeringPatterns,
  featureeng: FeatureEngineering,
  mathstats: MathStats,
};
