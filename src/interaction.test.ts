import { describe, expect, test } from "bun:test";
import {
	failurePulse,
	passwordIntensity,
	pointerProximity,
	submitBurst,
} from "./interaction";

describe("tesseract interaction", () => {
	test("maps password progress into a bounded intensity", () => {
		expect(passwordIntensity(0)).toBe(0);
		expect(passwordIntensity(9)).toBe(0.5);
		expect(passwordIntensity(18)).toBe(1);
		expect(passwordIntensity(256)).toBe(1);
	});

	test("maps pointer distance from the form into proximity", () => {
		const bounds = { left: 100, top: 100, width: 400, height: 200 };

		expect(pointerProximity({ x: 300, y: 200 }, bounds)).toBe(0);
		expect(pointerProximity({ x: 900, y: 200 }, bounds)).toBe(1);
	});

	test("uses a fast attack and slow decay for submit", () => {
		expect(submitBurst(-1)).toBe(0);
		expect(submitBurst(90)).toBe(0.5);
		expect(submitBurst(180)).toBe(1);
		expect(submitBurst(900)).toBeGreaterThan(0.5);
		expect(submitBurst(1_800)).toBe(0);
	});

	test("decays the failed-password pulse", () => {
		expect(failurePulse(0)).toBe(1);
		expect(failurePulse(800)).toBe(0.25);
		expect(failurePulse(1_600)).toBe(0);
	});
});
