## zandoc-loader

A webpack loader to parse zandoc markdown to structured data using [unified](https://github.com/unifiedjs/unified).

### Usage

Use as a webpack loader.

```js
{
	module: {
		rules: [
			{
			test: /\.md$/,
			use: [
				// additional loaders to convert markdown AST to js
				'zandoc-loader'
			]
			}
		]
	}
}
```

### Output

This loader emits an array of unified ASTs, so additional loaders must be used to convert these ASTs to js code.

Output array can have 3 types of ASTs, use `contentType` on the root to check type:

* style: indicates a style tree, there will be only one style tree in the output if any. All styles tag in the markdown will be consolidated.
* demo: indicates a demo tree, a demo consists of a code fragment and an optional title
* markdown: indicates a normal markdown tree.

`zandoc-loader-utils` consists some utilities for working with these ASTs.
