export function createTitleAdminControl({
  holdDurationMilliseconds,
  onAdministratorEnabled,
  onAdministratorDisabled,
}: {
  holdDurationMilliseconds: number;
  onAdministratorEnabled(): void;
  onAdministratorDisabled(): void;
}) {
  let holdTimeout: ReturnType<typeof setTimeout> | undefined;
  let ignoreNextClick = false;

  return {
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleClick,
  };

  function handlePointerDown(): void {
    clearHold();
    holdTimeout = setTimeout(() => {
      ignoreNextClick = true;
      onAdministratorEnabled();
    }, holdDurationMilliseconds);
  }

  function handlePointerUp(): void {
    clearHold();
  }

  function handlePointerCancel(): void {
    clearHold();
  }

  function handleClick(): void {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      return;
    }
    onAdministratorDisabled();
  }

  function clearHold(): void {
    if (holdTimeout === undefined) return;
    clearTimeout(holdTimeout);
    holdTimeout = undefined;
  }
}
