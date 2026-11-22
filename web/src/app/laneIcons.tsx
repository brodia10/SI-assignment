import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MoveToInboxOutlinedIcon from "@mui/icons-material/MoveToInboxOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import type { SvgIconProps } from "@mui/material";
import type { ComponentType } from "react";
import type { LaneId } from "./navigation";

export const laneIcons: Record<LaneId, ComponentType<SvgIconProps>> = {
  purchasing: ReceiptLongOutlinedIcon,
  receiving: MoveToInboxOutlinedIcon,
  processing: CallSplitOutlinedIcon,
  sales: LocalShippingOutlinedIcon,
  reports: AssessmentOutlinedIcon,
  admin: AdminPanelSettingsOutlinedIcon,
};
