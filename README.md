# draw.io - Custom Animation Plugin
This project provides a draw.io plugin that enables custom animations for diagrams, focusing on enhancing the visualization of Sequence Diagrams and their interaction with Class Diagrams. Users can define a sequence of animation steps to highlight elements, animate message flows, and dynamically show relationships between different diagram types.

## Features
- **Custom Animation Playback**: Play predefined animation scripts directly within Draw.io.
- **Interactive Animation Window**: A dedicated window to input, preview, and manage animation scripts.
- **Animation Script Generation**: Automatically generate animation scripts from existing Sequence and Class Diagrams.
- **Element Highlighting**: Animate cells (lifelines, activation bars, classes, methods) by changing their fill color, stroke color, and font style.
- **Arrow Animation**: Animate message flows in sequence diagrams and relations in class diagrams.
- **Inter-Diagram Linking**: Dynamically add and remove visual links (yellow arrows) between elements in Sequence Diagrams and Class Diagrams to show their correspondence.
- **Fragment Support**: Recognizes and animates `alt`, `opt`, `loop`, and `par` fragments in Sequence Diagrams.
- **File Upload**: Load animation scripts from `.txt` files.

## Prerequisites
To use this plugin, you need to have the **draw.io Desktop application installed**.

You can download the latest version of draw.io Desktop from the official GitHub releases page:
[draw.io Desktop Releases](https://github.com/jgraph/drawio-desktop/releases)

Choose the appropriate installer for your operating system (e.g., `.deb` for Debian/Ubuntu, `.exe` for Windows, `.dmg` for macOS).

## Quick Start
To use this plugin in draw.io desktop, follow these steps:

1.  **Clone the repository**

2.  **Run draw.io with plugin support**:
    *   Open your terminal and navigate to the cloned repository directory. Then run draw.io using one of the following commands:
        ```bash
        drawio --enable-plugins
        # Or to instantly open a diagram with plugins enabled:
        drawio --enable-plugins diagrams/diagrams_animated.drawio
        ```

3.  **Load Plugins in draw.io**:
    *   In draw.io, go to `Extras` > `Plugins...`.
    *   Click "Add" and navigate to the `plugins/` directory in your cloned repository.
    *   Select `customAnimation.js` and `generateCustomAnim.js` to load them.

4.  **Refresh draw.io**:
    *   After configuring the plugins, refresh draw.io (by closing and reopening the application by a command in setp 2) to ensure the plugins are loaded and active.

After installation, you will find new options under the `Extras` menu:
-   `Custom Animation...`: Opens the custom animation playback window.
-   `Generate Custom Animation...`: Generates an animation script based on the current diagram.

## Usage

### Custom Animation Window
1.  Go to `Extras` > `Custom Animation...` to open the animation control panel.
2.  In the text area, you can write or paste your animation script.
3.  Use the provided buttons to insert common animation commands for selected cells.
4.  Click `Preview` to run the animation on a cloned version of your diagram.
5.  Click `Stop` to halt the animation and clear the preview.
6.  Click `Apply` to save the current script to your diagram's metadata.
7.  You can also `Upload` a `.txt` file containing an animation script.

### Generating Animations
1.  Create a draw.io diagram containing both a Sequence Diagram and a Class Diagram. Ensure that:
    *   The Sequence Diagram elements are on a layer named `SqD`.
    *   The Class Diagram elements are on a layer named `CD`.
    *   Lifelines in the Sequence Diagram have labels that match the corresponding class names in the Class Diagram.
    *   Messages in the Sequence Diagram have labels that match method names in the Class Diagram (e.g., `methodName()`).
2.  Go to `Extras` > `Generate Custom Animation...`.
3.  A `animation.txt` file will be downloaded containing the generated animation script.
4.  You can then load this script into the `Custom Animation` window using the `Upload` button or by copying and pasting its content.

### Animation Commands
The animation script uses a simple command-line syntax:
-   `animate [CELL_ID]`: Highlights a cell (e.g., lifeline, class, method) with a blue fill and bold font.
-   `hide [CELL_ID]`: Resets a cell to its original style.
-   `roll [CELL_ID]`: Animates an arrow (edge) by highlighting its stroke.
-   `flow [CELL_ID] [start|stop|toggle]`: Controls a flowing animation effect on an edge.
-   `wait [MILLISECONDS]`: Pauses the animation for the specified duration (e.g., `wait 1500` for 1.5 seconds).
-   `add [SOURCE_ID] [TARGET_ID]`: Adds an arrow between two cells (e.g., between a method in CD and a message in SqD).
-   `remove [SOURCE_ID] [TARGET_ID]`: Removes a previously added arrow.

## Troubleshooting

### Ubuntu Plugin Loading Issue
On Ubuntu, you might encounter an issue where the plugins are not loaded correctly after closing and reopening draw.io. If this happens, you may need to manually remove the plugin files from the Draw.io configuration directory before reloading them:
```bash
rm ~/.config/draw.io/plugins/customAnimation.js ~/.config/draw.io/plugins/generateCustomAnim.js
```
After removing, reload the plugins in draw.io as described in the Quick Start section (step 3).

### Plugin Not Appearing
If the plugin doesn't appear in the `Extras` menu:
 - Verify that the plugin files are in the correct path
 - Ensure draw.io was launched with the `--enable-plugins` flag
 - Check file permissions on the plugin files (they should be readable)
 - Try restarting draw.io completely

### Inspecting Logs
If you encounter unexpected behavior, open the application's developer tools to check for errors, go to `Help` > `Open Developer Tools`.

## Supported Diagram Types
-   **Sequence Diagrams**: Lifelines, messages (calls and returns), activation bars, and fragments (alt, opt, loop, par).
-   **Class Diagrams**: Classes, methods, and relations between classes.

## Project Structure
-   `plugins/customAnimation.js`: Handles the UI and playback logic for custom animations.
-   `plugins/generateCustomAnim.js`: Contains the logic for parsing draw.io XML and generating animation scripts.
-   `diagrams/`: Contains example draw.io diagrams.
