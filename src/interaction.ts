const passwordReferenceLength = 18;
const burstAttackMs = 180;
const burstDurationMs = 1_800;
const failureDurationMs = 1_600;

export interface RectBounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export const passwordIntensity = (length: number): number =>
	clampUnit(length / passwordReferenceLength);

export const pointerProximity = (
	pointer: Readonly<{ x: number; y: number }>,
	bounds: RectBounds,
): number => {
	const centerX = bounds.left + bounds.width / 2;
	const centerY = bounds.top + bounds.height / 2;
	const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY);
	const radius = Math.max(bounds.width, bounds.height) / 2;

	return clampUnit((distance - radius) / 400);
};

export const submitBurst = (elapsedMs: number): number => {
	if (elapsedMs < 0 || elapsedMs >= burstDurationMs) return 0;
	if (elapsedMs < burstAttackMs) return elapsedMs / burstAttackMs;

	const decay = (elapsedMs - burstAttackMs) / (burstDurationMs - burstAttackMs);
	return 1 - decay * decay;
};

export const failurePulse = (elapsedMs: number): number => {
	if (elapsedMs < 0 || elapsedMs >= failureDurationMs) return 0;
	return (1 - elapsedMs / failureDurationMs) ** 2;
};
