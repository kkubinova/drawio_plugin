# draw.io Animation Plugins

This folder contains two complementary plugins for creating and managing custom animations in draw.io diagrams.

## Overview

These plugins enable interactive animations for UML sequence and class diagrams, allowing you to visualize execution flow and relationships between diagram elements.

## Plugins

### 1. customAnimation.js

**Purpose**: Provides a UI for creating, editing, and previewing custom animations manually.

**Key Features**:
- **Animation Editor Window**: Opens via `Extras > Custom Animation...` menu
- **Live Preview**: Real-time preview pane showing animation execution
- **Command Buttons**: Quick-insert buttons for common animation commands
- **File Upload**: Load animation scripts from `.txt` files
- **Animation Commands**:
  - `animate CELL` - Highlight cell with blue color and bold text
  - `hide CELL` - Return cell to original style
  - `roll CELL` - Animate cell with wipe-in effect
  - `flow CELL [start|stop]` - Toggle animated flow on edges
  - `wait MILLISECONDS` - Pause animation
  - `add SOURCE TARGET` - Create yellow arrow between diagrams
  - `remove SOURCE TARGET` - Remove yellow arrow between diagrams

**Technical Details**:
- Stores animation scripts in diagram's root cell attribute `customAnimation`
- Auto-starts animations in chromeless view mode
- Supports smooth color transitions using `requestAnimationFrame`
- Provides interactive preview with panning and zoom controls

**Usage**:
1. Open draw.io diagram
2. Select `Extras > Custom Animation...`
3. Select cells and click command buttons to insert animation steps
4. Click `Preview` to test animation
6. Optionally upload pre-written animation scripts from `.txt` file

---

### 2. generateCustomAnim.js

**Purpose**: Automatically generates animation scripts from UML sequence and class diagrams.

**Key Features**:
- **Automatic Script Generation**: Analyzes diagram structure and creates animation sequences
- **Dual-Diagram Support**: Coordinates animations between sequence diagrams (SqD) and class diagrams (CD)
- **Fragment Support**: Handles UML fragments (`alt`, `opt`, `loop`, `par`)
- **Smart Matching**: Links lifelines to classes and messages to methods by label matching
- **Export**: Downloads generated animation as `animation.txt`

**Technical Details**:

**Diagram Parsing**:
- Extracts elements from two layers: `SqD` (Sequence Diagram) and `CD` (Class Diagram)
- Identifies lifelines, activation bars, messages, fragments, classes, and relations
- Calculates absolute positions for proximity-based matching

**Animation Logic**:
- Follows message flow in vertical order (top to bottom)
- Highlights elements as execution progresses:
  - Lifelines and activation bars in sequence diagram
  - Classes and methods in class diagram
  - Relations (arrows) between classes
  - Inter-diagram links (yellow arrows)
- Unhighlights elements when execution returns
- Handles fragment visibility based on active messages

**Matching Algorithm**:
- **Lifeline ↔ Class**: Matches by exact label text
- **Message ↔ Method**: Matches message label (without parameters) to method name
- **Activation Bar ↔ Lifeline**: Uses proximity detection with configurable padding
- **Arrow Endpoints ↔ Classes**: Proximity-based matching when explicit connections missing

**Usage**:
1. Create sequence diagram with lifelines and messages in `SqD` layer
2. Create class diagram with matching class names in `CD`
3. Select `Extras > Generate Custom Animation...`
4. Animation script downloads as `animation.txt`
5. Upload to Custom Animation window for playback


## Animation Script Format

Animation scripts are plain text files with one command per line:

```
animate cellId          # Highlight cell
hide cellId            # Unhighlight cell
roll cellId            # Wipe-in animation
flow cellId start      # Start edge flow animation
flow cellId stop       # Stop edge flow animation
wait 1500              # Pause for 1500ms
add sourceId targetId  # Add yellow arrow
remove sourceId targetId # Remove yellow arrow
```

**Cell IDs**: Use the internal draw.io cell IDs (visible in XML or via selection)


## Workflow Example

1. **Design Diagrams**:
   - Create sequence diagram in `SqD` layer
   - Create class diagram in `CD` layer
   - Ensure matching labels between lifelines and classes

2. **Generate Animation**:
   - Run `Generate Custom Animation...`
   - Review downloaded `animation.txt`

3. **Customize (Optional)**:
   - Edit `animation.txt` to adjust timing or add custom steps
   - Add manual highlights for specific elements

4. **Preview**:
   - Open `Custom Animation...` window
   - Upload or paste animation script
   - Click `Preview` to test


## Configuration Constants

### generateCustomAnim.js

```javascript
FRAGMENT_TYPES = ['alt', 'opt', 'loop', 'par']   // Supported UML fragments
DEFAULT_WAIT_TIME = 1500                         // Default pause duration (ms)
PROXIMITY_PADDING = 10                           // Matching tolerance (pixels)
SEQUENCE_DIAGRAM_LAYER = "SqD"                   // Sequence diagram layer name
CLASS_DIAGRAM_LAYER = "CD"                       // Class diagram layer name
```



## Folder Structure

```
plugins/
├── README.md                 # This file
├── customAnimation.js        # Animation player and editor
└── generateCustomAnim.js     # Automatic script generator
```


## Development Notes

Both plugins extend draw.io using the [`Draw.loadPlugin()`](customAnimation.js:4) API and integrate with the `Extras` menu. They share animation command syntax but serve different purposes:

- **customAnimation.js**: Manual creation and playback
- **generateCustomAnim.js**: Automated generation from diagram structure

For implementation details, see inline comments in each plugin file.
