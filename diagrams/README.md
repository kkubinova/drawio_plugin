# Example Diagrams

This folder contains example draw.io diagrams demonstrating the custom animation plugin capabilities.

---

## 📑 Table of Contents

- [Examples](#-examples)
- [How to Use These Examples](#-how-to-use-these-examples)
- [Diagram Structure](#-diagram-structure)
- [Creating Your Own Examples](#-creating-your-own-examples)
- [Additional Diagrams](#-additional-diagrams)

---

## 🎨 Examples

<details open>
<summary><b>Simple Example</b> - <a href="examples/simple.drawio"><code>examples/simple.drawio</code></a></summary>

**Description**: Basic sequence and class diagram example demonstrating fundamental animation concepts.

**Features**:
- Simple lifeline-to-class matching
- Basic method calls and returns
- Straightforward message flow

**Resources**:
- Animation Script: [`examples/simple_animation.txt`](examples/simple_animation.txt)
- Preview Video: [`examples/simple_preview.mp4`](examples/simple_preview.mp4)

https://github.com/user-attachments/assets/4f5ea0e5-6f6a-4f83-b0b7-4cd313060337

</details>

<details>
<summary><b>Complex Example</b> - <a href="examples/more_complex.drawio"><code>examples/more_complex.drawio</code></a></summary>

**Description**: Complex multi-class interaction example with multiple lifelines and method calls.

**Features**:
- Multiple interacting classes
- Complex message flow patterns
- Advanced lifeline interactions

</details>

<details>
<summary><b>Fragments Example</b> - <a href="examples/fragments.drawio"><code>examples/fragments.drawio</code></a></summary>

**Description**: Examples demonstrating UML fragment support.

**Supported Fragments**:
- `alt` - Alternative flows
- `opt` - Optional flows
- `loop` - Iterative flows
- `par` - Parallel flows

</details>

<details>
<summary><b>Additional Fragment Examples</b> - <a href="examples/fragments_examples/"><code>examples/fragments_examples/</code></a></summary>

Contains additional fragment-specific examples:

- [`alt_01.drawio`](examples/fragments_examples/alt_01.drawio) - Basic alternative fragment
- [`alt_02.drawio`](examples/fragments_examples/alt_02.drawio) - Alternative fragment variation
- [`alt_03_without_return_arrows.drawio`](examples/fragments_examples/alt_03_without_return_arrows.drawio) - ⚠️ Alternative flow without return arrows (demonstrates current limitation where missing return arrows can cause animation issues)

</details>


---

## 🚀 How to Use These Examples

### Step 1: Open in draw.io Desktop
- Windows
```bash
"C:\Program Files\draw.io\draw.io.exe" --enable-plugins examples\simple.drawio
```

- Ubuntu/Linux

```bash
drawio --enable-plugins examples/simple.drawio
```

</details>

### Step 2: Load the Plugins

1. Go to **`Extras`** > **`Plugins...`**
2. Add [`customAnimation.js`](../plugins/customAnimation.js) and [`generateCustomAnim.js`](../plugins/generateCustomAnim.js)

### Step 3: Generate Animation (Optional)

1. Select **`Extras`** > **`Generate Custom Animation...`**
2. Download the generated `animation.txt`

### Step 4: Play Animation

1. Select **`Extras`** > **`Custom Animation...`**
2. Upload the animation script or paste it into the text area
3. Click **`Preview`** to watch the animation

---

## 🏗️ Diagram Structure

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

---

## ✨ Creating Your Own Examples

To create a new animated diagram:

1. Create two layers: `SqD` and `CD`
2. Draw your sequence diagram in the `SqD` layer
3. Draw your class diagram in the `CD` layer
4. Ensure lifeline labels match class names
5. Ensure message labels match method names
6. Generate the animation script
7. Test and refine the animation

For detailed instructions, see the [`plugins/README.md`](../plugins/README.md:1).

---

## 📦 Additional Diagrams

The root `diagrams/` folder also contains development and test diagrams:
- Various versions of animated diagrams (`diagrams_animated_*.drawio`)
- JSON and XML exports for testing

These are primarily for development and testing purposes.
