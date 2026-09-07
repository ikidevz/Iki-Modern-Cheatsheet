import type { ReactNode } from "react";
import type { Sheet } from "@/lib/types";
import { AbTesting } from "./abtesting";
import { Clustering } from "./clustering";
import { DataModelingExamples } from "./data-modeling-examples";
import { DataEngineeringPatterns } from "./depatterns";
import { ExploratoryDataAnalysis } from "./eda";
import { FeatureEngineering } from "./featureeng";
import { MathStats } from "./mathstats";

export type CustomizedComponentProps = {
	item: Sheet;
	body: string | null;
};

export type CustomizedComponent = (
	props: CustomizedComponentProps,
) => ReactNode;

export type AsyncCustomizedComponent = (
	props: CustomizedComponentProps,
) => Promise<ReactNode>;

export const CUSTOMIZED_COMPONENTS: Record<string, CustomizedComponent> = {
	abtesting: AbTesting,
	clustering: Clustering,
	depatterns: DataEngineeringPatterns,
	eda: ExploratoryDataAnalysis,
	featureeng: FeatureEngineering,
	mathstats: MathStats,
};

export const ASYNC_CUSTOMIZED_COMPONENTS: Record<
	string,
	AsyncCustomizedComponent
> = {
	"data-modeling-examples": DataModelingExamples,
};
