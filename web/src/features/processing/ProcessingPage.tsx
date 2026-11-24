import { Alert, Button, CircularProgress, Stack } from "@mui/material";
import { useCallback, useState } from "react";
import { useLeaveGuard } from "../../components";
import { type InputOption, type PostedWorkOrder, useRefreshWorkOrderOptions, useWorkOrderOptions } from "./api";
import { OutputsStep } from "./OutputsStep";
import { PickInputStep } from "./PickInputStep";
import { WorkOrderPosted } from "./WorkOrderPosted";
import type { DraftOutput } from "./workOrderDraft";

/**
 * Run a work order: pick the in-stock item, add what came off the line, confirm, post.
 * Steps are local state rather than routes: a half-built work order isn't worth a URL, and the back button
 * leaving the screen is what a purchaser expects.
 */
export function ProcessingPage() {
  const options = useWorkOrderOptions();
  const refreshOptions = useRefreshWorkOrderOptions();
  // The picked item as it was when picked, so its tag is still known if it drops out of the in-stock list.
  const [picked, setPicked] = useState<InputOption | null>(null);
  // Outputs survive "Pick a different item" on purpose: picking the wrong coil shouldn't cost the purchaser the
  // outputs they already entered. The confirmation shows them again before anything posts.
  const [outputs, setOutputs] = useState<DraftOutput[]>([]);
  const [posted, setPosted] = useState<PostedWorkOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useLeaveGuard(!posted && outputs.length > 0, "work order");

  const onInputGone = useCallback(
    (message: string) => {
      setNotice(message);
      setPicked(null);
      refreshOptions(); // so the used item leaves the pick list instead of bouncing the purchaser again
    },
    [refreshOptions],
  );

  function startOver() {
    setPosted(null);
    setPicked(null);
    setOutputs([]);
    setNotice(null);
  }

  if (posted) return <WorkOrderPosted posted={posted} onAnother={startOver} />;

  if (options.isPending)
    return (
      <Stack sx={{ alignItems: "center", py: 8 }}>
        <CircularProgress aria-label="Loading" />
      </Stack>
    );
  if (options.isError)
    return (
      <Alert
        severity="error"
        sx={{ fontSize: "1.1rem" }}
        action={
          <Button color="inherit" onClick={() => options.refetch()}>
            Try again
          </Button>
        }
      >
        {options.error.message}
      </Alert>
    );

  // If the item drops out of the in-stock list (used on another iPad, or a post whose reply was lost but which went
  // through), fall back to the pick list and say why rather than silently changing screens.
  const input = picked && options.data.inputs.find((i) => i.id === picked.id);
  if (!input) {
    const lost = picked
      ? `${picked.tag} is no longer in stock. It was processed or sold, maybe by the work order you just posted. Check inventory before running it again.`
      : null;
    return (
      <PickInputStep
        inputs={options.data.inputs}
        notice={notice ?? lost}
        onPick={(id) => {
          setPicked(options.data.inputs.find((i) => i.id === id) ?? null);
          setNotice(null);
        }}
      />
    );
  }

  return (
    <OutputsStep
      input={input}
      products={options.data.products}
      locations={options.data.locations}
      outputs={outputs}
      onOutputsChange={setOutputs}
      onChangeInput={() => setPicked(null)}
      onInputGone={onInputGone}
      onPosted={setPosted}
    />
  );
}
