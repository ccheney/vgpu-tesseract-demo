import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { clock, effect, frameLoop, init, surface } from "vgpu";
import {
	failurePulse,
	passwordIntensity,
	pointerProximity,
	submitBurst,
} from "./interaction";
import "./style.css";
import shaderSource from "./tesseract.wgsl?raw";

const requiredElement = <ElementType extends Element>(
	root: ParentNode,
	selector: string,
): ElementType => {
	const element = root.querySelector<ElementType>(selector);
	if (!element) throw new Error(`Demo element is missing: ${selector}`);
	return element;
};

const demo = requiredElement<HTMLElement>(document, "[data-demo]");
const canvas = requiredElement<HTMLCanvasElement>(
	demo,
	"[data-tesseract-canvas]",
);
const form = requiredElement<HTMLFormElement>(demo, "form");
const input = requiredElement<HTMLInputElement>(form, "input[name='password']");
const button = requiredElement<HTMLButtonElement>(
	form,
	"button[type='submit']",
);
const status = requiredElement<HTMLElement>(form, "[data-status]");
const reducedMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;
let submitStartedAt: number | undefined;
let failureStartedAt: number | undefined;
let failureTimer: number | undefined;
let pointerDistance = 1;
let focused = document.activeElement === input;

const resetFailure = (): void => {
	if (form.dataset.state !== "failure") return;

	delete form.dataset.state;
	input.removeAttribute("aria-invalid");
	status.textContent = "";
	failureStartedAt = undefined;
};

const updateIntensity = (): void => {
	demo.style.setProperty(
		"--demo-intensity",
		String(passwordIntensity(input.value.length)),
	);
	resetFailure();
};

input.addEventListener("input", updateIntensity);
input.addEventListener("focus", () => {
	focused = true;
});
input.addEventListener("blur", () => {
	focused = false;
});
demo.addEventListener("pointermove", (event) => {
	pointerDistance = pointerProximity(event, form.getBoundingClientRect());
});
demo.addEventListener("pointerleave", () => {
	pointerDistance = 1;
});
form.addEventListener("submit", (event) => {
	event.preventDefault();
	if (form.dataset.state === "verifying") return;

	window.clearTimeout(failureTimer);
	form.dataset.state = "verifying";
	input.removeAttribute("aria-invalid");
	button.disabled = true;
	status.textContent = "VERIFYING ACCESS";
	submitStartedAt = performance.now();
	failureStartedAt = undefined;

	failureTimer = window.setTimeout(
		() => {
			form.dataset.state = "failure";
			input.setAttribute("aria-invalid", "true");
			button.disabled = false;
			status.textContent = "ACCESS DENIED";
			failureStartedAt = performance.now();
			input.focus();
		},
		reducedMotion ? 0 : 420,
	);
});
updateIntensity();

try {
	const gpu = await init();
	const canvasSurface = surface(gpu, canvas, {
		alphaMode: "premultiplied",
		clearColor: [0.0353, 0.0353, 0.0431, 1],
		dpr: [1, 2],
		label: "tesseract-demo-surface",
	});
	const tesseract = effect(gpu, shaderSource, {
		label: "tesseract-demo",
		set: {
			params: {
				resolution: canvasSurface.size,
				time: 0,
				intensity: passwordIntensity(input.value.length),
				proximity: 1,
				burst: 0,
				failure: 0,
			},
		},
	});
	const unsubscribeResize = canvasSurface.onResize(({ width, height }) => {
		tesseract.set({ params: { resolution: [width, height] } });
	});
	const unsubscribeError = gpu.onError((error) => {
		console.error(error);
		demo.dataset.renderer = "fallback";
	});
	await tesseract.compile({
		colors: [canvasSurface.format],
		sampleCount: canvasSurface.sampleCount,
	});
	demo.dataset.renderer = "webgpu";
	const animationClock = clock(gpu);
	const loop = frameLoop(
		gpu,
		(currentFrame) => {
			const now = performance.now();
			tesseract.set({
				params: {
					time: reducedMotion ? 0 : animationClock.time,
					intensity: passwordIntensity(input.value.length),
					proximity: Math.min(pointerDistance, focused ? 0.25 : 1),
					burst:
						submitStartedAt === undefined
							? 0
							: submitBurst(now - submitStartedAt),
					failure:
						failureStartedAt === undefined
							? 0
							: failurePulse(now - failureStartedAt),
				},
			});
			currentFrame.pass(canvasSurface, tesseract);
		},
		{ fps: reducedMotion ? 12 : 60 },
	);

	window.addEventListener(
		"pagehide",
		() => {
			window.clearTimeout(failureTimer);
			loop.stop();
			unsubscribeResize();
			unsubscribeError();
			canvasSurface.dispose();
			gpu.dispose();
		},
		{ once: true },
	);
} catch (error) {
	console.error(error);
	demo.dataset.renderer = "fallback";
}
