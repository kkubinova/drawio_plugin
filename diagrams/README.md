# Example Diagrams

This folder contains example draw.io diagrams demonstrating the custom animation plugin capabilities.

## Examples

### [`examples/simple.drawio`](examples/simple.drawio)
**Description**: Basic sequence and class diagram example demonstrating fundamental animation concepts.

**Features**:
- Simple lifeline-to-class matching
- Basic method calls and returns
- Straightforward message flow

**Animation Script**: [`examples/simple_animation.txt`](examples/simple_animation.txt)

**Preview Video**: [`examples/simple_preview.mp4`](examples/simple_preview.mp4)

https://github.com/user-attachments/assets/4f5ea0e5-6f6a-4f83-b0b7-4cd313060337


### [`examples/more_complex.drawio`](examples/more_complex.drawio)
**Description**: Complex multi-class interaction example with multiple lifelines and method calls.


### [`examples/fragments.drawio`](examples/fragments.drawio)
**Description**: Examples demonstrating UML alt fragment support.


### [`examples/fragments examples/`](examples/fragments_examples/)
Contains additional fragment-specific examples.

#### [`alt_03_without_return_arrows.drawio`](examples/fragments_examples/alt_03_without_return_arrows.drawio)
**Description**: Alternative flow without return arrows. This example demonstrates the current limitation where missing return arrows can cause animation issues.


## How to Use These Examples

1. **Open in draw.io Desktop**:
   ```bash
   drawio --enable-plugins examples/simple.drawio
   ```

2. **Load the Plugins**:
   - Go to `Extras` > `Plugins...`
   - Add [`customAnimation.js`](../plugins/customAnimation.js:1) and [`generateCustomAnim.js`](../plugins/generateCustomAnim.js:1)

3. **Generate Animation** (optional):
   - Select `Extras` > `Generate Custom Animation...`
   - Download the generated `animation.txt`

4. **Play Animation**:
   - Select `Extras` > `Custom Animation...`
   - Upload the animation script or paste it into the text area
   - Click `Preview` to watch the animation

5. **View in Chromeless Mode**:
   - Open the diagram with `?lightbox=1` parameter
   - Animation plays automatically in loop

## Diagram Structure

All example diagrams follow this structure:
- **Layer `SqD`**: Contains the Sequence Diagram elements
  - Lifelines
  - Messages (calls and returns)
  - Activation bars
  - Fragments (alt, opt, loop, par)

- **Layer `CD`**: Contains the Class Diagram elements
  - Classes
  - Methods
  - Relations between classes

## Creating Your Own Examples

To create a new animated diagram:

1. Create two layers: `SqD` and `CD`
2. Draw your sequence diagram in the `SqD` layer
3. Draw your class diagram in the `CD` layer
4. Ensure lifeline labels match class names
5. Ensure message labels match method names
6. Generate the animation script
7. Test and refine the animation

For detailed instructions, see the [`plugins/README.md`](../plugins/README.md:1).

## Additional Diagrams

The root `diagrams/` folder also contains development and test diagrams:
- Various versions of animated diagrams (`diagrams_animated_*.drawio`)
- JSON and XML exports for testing

These are primarily for development and testing purposes.
