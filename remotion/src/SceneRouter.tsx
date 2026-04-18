/**
 * SceneRouter — routes SceneData to correct template variant.
 *
 * variant = "infographic" (default): text owns center, full opaque layout
 * variant = "animation_hook": text in caption zone y:1240–1680, transparent bg for iMovie composite
 *
 * TakeawayScene is NOT handled here — requires durationFrames from VideoComposition.
 */

import React from "react";
import type { SceneData } from "./types";

// Infographic (default)
import { ComparisonSplit } from "./layouts/ComparisonSplit";
import { MetricFocus }     from "./layouts/MetricFocus";
import { PipelineFlow }    from "./layouts/PipelineFlow";
import { DataGrid }        from "./layouts/DataGrid";
import { KineticBridge }   from "./layouts/KineticBridge";
import { StatementSlam }   from "./layouts/StatementSlam";
import { TimelineFlow }    from "./layouts/TimelineFlow";
import { TriStat }         from "./layouts/TriStat";
import { LeaderboardRank } from "./layouts/LeaderboardRank";
import { BarComparison }   from "./layouts/BarComparison";
import { CodeDiff }        from "./layouts/CodeDiff";
import { TerminalScene }   from "./layouts/TerminalScene";

// Animation hook caption-zone variants
import {
  StatementSlamThreeJS,
  TriStatThreeJS,
  MetricFocusThreeJS,
  DataGridThreeJS,
} from "./templates/animation_hook";

export type TemplateVariant = "infographic" | "animation_hook";

export const SceneRouter: React.FC<{
  data: SceneData;
  variant?: TemplateVariant;
}> = ({ data, variant = "infographic" }) => {

  if (variant === "animation_hook") {
    switch (data.layout) {
      case "StatementSlam": return <StatementSlamThreeJS data={data} />;
      case "TriStat":       return <TriStatThreeJS data={data} />;
      case "MetricFocus":   return <MetricFocusThreeJS data={data} />;
      case "DataGrid":      return <DataGridThreeJS data={data} />;
      default: break; // fallthrough to infographic for unimplemented variants
    }
  }

  switch (data.layout) {
    case "ComparisonSplit":  return <ComparisonSplit data={data} />;
    case "MetricFocus":      return <MetricFocus data={data} />;
    case "PipelineFlow":     return <PipelineFlow data={data} />;
    case "DataGrid":         return <DataGrid data={data} />;
    case "KineticBridge":    return <KineticBridge data={data} />;
    case "StatementSlam":    return <StatementSlam data={data} />;
    case "TimelineFlow":     return <TimelineFlow data={data} />;
    case "TriStat":          return <TriStat data={data} />;
    case "LeaderboardRank":  return <LeaderboardRank data={data} />;
    case "BarComparison":    return <BarComparison data={data} />;
    case "CodeDiff":         return <CodeDiff data={data} />;
    case "TerminalScene":    return <TerminalScene data={data} />;
    case "TakeawayScene":    return null;
    default:                 return null;
  }
};
