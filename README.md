# vGPU Tesseract Demo

A password-reactive 4D tesseract rendered with WebGPU using [vGPU](https://vgpu.sh/).

This is a visual demo, not an authentication system. Passwords never leave the browser and every submission intentionally fails.

## Run

```sh
bun install
bun run dev
```

## Verify

```sh
bun test
bun run check
bun run shader:check
bun run build
```

## License

MIT

