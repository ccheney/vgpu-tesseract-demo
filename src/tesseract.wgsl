struct Params {
	resolution: vec2f,
	time: f32,
	intensity: f32,
	proximity: f32,
	burst: f32,
	failure: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

fn tesseractVertex(index: u32) -> vec4f {
	return vec4f(
		f32(index & 1u) * 2.0 - 1.0,
		f32((index >> 1u) & 1u) * 2.0 - 1.0,
		f32((index >> 2u) & 1u) * 2.0 - 1.0,
		f32((index >> 3u) & 1u) * 2.0 - 1.0,
	);
}

fn tesseractEdge(index: u32) -> vec2u {
	if (index < 8u) {
		let start = index * 2u;
		return vec2u(start, start + 1u);
	}
	if (index < 16u) {
		let localIndex = index - 8u;
		let start = (localIndex / 2u) * 4u + localIndex % 2u;
		return vec2u(start, start + 2u);
	}
	if (index < 24u) {
		let localIndex = index - 16u;
		let start = (localIndex / 4u) * 8u + localIndex % 4u;
		return vec2u(start, start + 4u);
	}

	let start = index - 24u;
	return vec2u(start, start + 8u);
}

fn rotateWithW(angle: f32, axis: vec3f) -> mat4x4f {
	let cosine = cos(angle);
	let sine = sin(angle);
	let bend = cosine - 1.0;
	return mat4x4f(
		vec4f(vec3f(1.0, 0.0, 0.0) + bend * axis * axis.x, sine * axis.x),
		vec4f(vec3f(0.0, 1.0, 0.0) + bend * axis * axis.y, sine * axis.y),
		vec4f(vec3f(0.0, 0.0, 1.0) + bend * axis * axis.z, sine * axis.z),
		vec4f(-sine * axis, cosine),
	);
}

fn projectVertex(vertex: vec4f, time: f32, speed: f32) -> vec2f {
	let rotation = rotateWithW(time * 0.25 * speed, vec3f(1.0, 0.0, 0.0)) *
		rotateWithW(time * 0.15 * speed, vec3f(0.0, -1.0, 0.0)) *
		rotateWithW(time * 0.1 * speed, vec3f(0.0, 0.0, -1.0));
	let rotated = rotation * vertex;
	let projected3d = rotated.xyz / max(0.2, 3.0 - rotated.w);
	return projected3d.xy * (2.0 / (projected3d.z + 4.0));
}

fn segmentDistance(point: vec2f, start: vec2f, end: vec2f) -> f32 {
	let fromStart = point - start;
	let segment = end - start;
	let progress = clamp(dot(fromStart, segment) / max(dot(segment, segment), 0.000001), 0.0, 1.0);
	return length(fromStart - segment * progress);
}

fn edgeLight(
	uv: vec2f,
	start: vec2f,
	end: vec2f,
	pixelSize: f32,
	bloomMultiplier: f32,
) -> f32 {
	let distance = segmentDistance(uv, start, end);
	let antialias = pixelSize * 1.5;
	let core = 1.0 - smoothstep(0.003 - antialias, 0.003 + antialias, distance);
	let bloom = exp(-distance * 35.0) * 0.06 * bloomMultiplier;
	let outerGlow = exp(-distance * 12.0) * 0.02 * bloomMultiplier;
	return core + bloom + outerGlow;
}

fn edgeColor(start: vec4f, end: vec4f) -> vec3f {
	let averageW = (start.w + end.w) * 0.5;
	return vec3f(0.2 + averageW * 0.1);
}

fn renderTesseract(
	uv: vec2f,
	time: f32,
	pixelSize: f32,
	speed: f32,
	bloomMultiplier: f32,
) -> vec3f {
	var color = vec3f(0.0);

	for (var index = 0u; index < 32u; index += 1u) {
		let edge = tesseractEdge(index);
		let startVertex = tesseractVertex(edge.x);
		let endVertex = tesseractVertex(edge.y);
		let start = projectVertex(startVertex, time, speed);
		let end = projectVertex(endVertex, time, speed);
		color += edgeColor(startVertex, endVertex) *
			edgeLight(uv, start, end, pixelSize, bloomMultiplier);
	}

	for (var index = 0u; index < 16u; index += 1u) {
		let point = projectVertex(tesseractVertex(index), time, speed);
		let distance = length(uv - point);
		let vertex = 1.0 - smoothstep(0.0, 0.008, distance);
		let bloom = exp(-distance * 60.0) * 0.075 * bloomMultiplier;
		color += vec3f(0.3) * (vertex * 0.125 + bloom);
	}

	return color;
}

fn random(point: vec2f) -> f32 {
	return fract(sin(dot(point, vec2f(12.9898, 78.233))) * 43758.5453);
}

@fragment
fn fs_main(@location(0) surfaceUv: vec2f) -> @location(0) vec4f {
	let shortestSide = min(params.resolution.x, params.resolution.y);
	let pixelPosition = surfaceUv * params.resolution;
	var uv = (pixelPosition - params.resolution * 0.5) / shortestSide;
	let pixelSize = 1.0 / shortestSide;
	let proximityExcitement = 1.0 - params.proximity;
	let shake = params.intensity * 0.015 + params.burst * 0.04 + params.failure * 0.018;
	uv += vec2f(
		sin(params.time * 50.0) * shake,
		cos(params.time * 47.0) * shake,
	);

	let speed = 1.0 + params.intensity * 1.5 + proximityExcitement +
		params.burst * 4.0 + params.failure * 0.8;
	let bloomMultiplier = 1.0 + params.intensity * 0.5 +
		params.burst * 2.5 + params.failure * 1.5;
	let tess = renderTesseract(uv, params.time * 0.5, pixelSize, speed, bloomMultiplier);
	let distanceFromCenter = length(uv);
	let aberration = distanceFromCenter * 0.4 *
		(1.0 + params.intensity * 0.5 + params.burst * 2.0 + params.failure);
	var color = tess;
	color.r *= 1.0 + aberration * 0.3;
	color.b *= 1.0 - aberration * 0.2;
	color *= 1.0 + params.burst * 0.5;
	color = mix(color, color * vec3f(2.1, 0.42, 0.25), params.failure * 0.82);

	let vignette = clamp(1.0 - distanceFromCenter * (0.5 - params.burst * 0.3), 0.0, 1.0);
	let scanline = 0.97 + 0.03 * sin(pixelPosition.y * 2.0);
	let dither = (random(uv + vec2f(fract(params.time))) - 0.5) * 0.01;
	let voidColor = vec3f(0.0353, 0.0353, 0.0431);
	let failureHalo = vec3f(0.12, 0.012, 0.008) * params.failure *
		max(0.0, 1.0 - distanceFromCenter * 1.7);
	let finalColor = voidColor + failureHalo + color * vignette * scanline + vec3f(dither);

	return vec4f(finalColor, 1.0);
}

