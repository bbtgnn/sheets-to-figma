# Spreadsheet to Figma

Sync content from Google Sheets directly into your Figma file.

## Step 1

Prepare your figma design. Aptly name your layers, cause they will be referenced by name in your spreadsheet!

## Step 2

Prepare your google spreadsheet:

- reserve first row for headings
- each row will be a copy of the design

Each column name should be: `layer_name` `.` `layer_property` (examples: `rectangle.fill`, `client.text`)

Available properties:

- `x` : number
- `y` : number
- `width` : number
- `height`: number
- `rotation`: number
- `fill` : image url or hex color
- `instance` : component name
- `text`: string

## Step 3

Make the spreadsheet public and copy the url

## Step 4

- Open the plugin
- Paste the url
- Select the layer
- Smash that big orange button! 🍊
