/**
 * vytvori animaciu pre class a sekvencny diagram, animuje aj sipky medzi classami 
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('generateCustomAnim=Generate Custom Animation...');

	function generateAnimation(fileJson) {
		const { xmlDoc, sqdCells, cdCells } = parseDiagramXml(editorUi);
		
		console.log("fileJson: \n", fileJson);

		const [lifelines, sqdMessages, fragments] = parseSequenceDiagram(sqdCells, cdCells, fileJson);
		const [cdClasses, cdRelations] = parseClassDiagram(sqdCells, cdCells);

		var animationScript = buildAnimationScript(lifelines, sqdMessages, cdClasses, cdRelations, cdCells);
	
		return animationScript;
	}

	function parseDiagramXml(editorUi) {
		var xml = editorUi.getFileData();
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(xml, "text/xml");
	       
		console.log("parseDiagramXml: parsed XML document\n", xml);

		var cells = Array.from(xmlDoc.getElementsByTagName("mxCell"));

		const sqdCells = getDiagramCells(cells, "SqD")   // SqD - name of layer for sequence diagram
		const cdCells  = getDiagramCells(cells, "CD");   //  CD - name of layer for class diagram

		return { xmlDoc, sqdCells, cdCells };
	}

	// Helper to extract lifeline with its activation bars
	function extractLifelines(cells) {			
		return cells.filter(cell =>
			cell.getAttribute("style") && cell.getAttribute("style").includes("shape=umlLifeline")
		).map(cell => {
			const activationBars = cells
				.filter(c =>
					c.getAttribute("vertex") === "1" &&
					c.getAttribute("parent") === cell.getAttribute("id") &&
					(!c.getAttribute("style") || !c.getAttribute("style").includes("shape=umlLifeline"))
				)
				.filter(c => {
					const geoElem = c.getElementsByTagName("mxGeometry")[0];
					if (!geoElem) return false;
					const width = parseFloat(geoElem.getAttribute("width")) || 0;
					const height = parseFloat(geoElem.getAttribute("height")) || 0;
					return width > 0 && height > 0;
				})
				.map(c => {
					const geoElem = c.getElementsByTagName("mxGeometry")[0];
					const x = parseFloat(geoElem.getAttribute("x"));
					const y = parseFloat(geoElem.getAttribute("y"));
					const width = parseFloat(geoElem.getAttribute("width"));
					const height = parseFloat(geoElem.getAttribute("height"));
					return {
						id: c.getAttribute("id"),
						x: x,
						y: y,
						widht: width,
						height: height
					};
				});

			return {
				id: cell.getAttribute("id"),
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				activationBars: activationBars
			};
		});
	}

	function parseSequenceDiagram(sqdCells, cdCells, fileJson) {
		const fragments = fileJson;

		// Extract lifelines from sqdCells
		var lifelines = extractLifelines(sqdCells);

		// Match lifelines to classes by label 
		lifelines.forEach(lf => {
			const match = cdCells.find(cell => cell.getAttribute("value") && lf.label && lf.label.trim() === cell.getAttribute("value").trim());
			if (match) {
				lf.matchedClassId = match.getAttribute("id");
			}
		});

		// Extract messages/arrows (edge="1") from sqdCells
		var messages = sqdCells.filter(cell =>
			cell.getAttribute("edge") === "1"
		).map(cell => ({
			id: cell.getAttribute("id"),
			label: cell.getAttribute("value"),
			parent: cell.getAttribute("parent"),
			source: cell.getAttribute("source"),
			target: cell.getAttribute("target"),
			dashed: cell.getAttribute("style").includes("dashed=1"), // true / false
			fragment: "",
			fragmentParent: "",
			subFragment: ""
		}));

		// Add fragment reference to message/arrow
		messages.forEach(msg => {
			fragments.forEach(fragment => {
				function isIdInFragmentLines(subFragment, targetId) {
					return subFragment.lines?.some(line => line.id === targetId);
				}

				fragment.child_areas.forEach(subFragment => {
					if (isIdInFragmentLines(subFragment, msg.id)) {
						msg.subFragment = subFragment.id;
						msg.fragment = fragment.id;
						msg.fragmentParent = fragment.parent;
					}
				})
			})
		})

		// Match messages to methods in matched class
		messages.forEach(msg => {
			const msgLabel = msg.label.replace(/\s*\([^)]*\)/, '').trim() // remove () from message label to match method name in a class

			const match = cdCells.find(cell => cell.getAttribute("value") && msgLabel && cell.getAttribute("value").includes(msgLabel));
			if (match) {
				msg.matchedMethodId = match.getAttribute("id");
			}
		});

		// Add position of source and target lifeline block to message/arrow 
		messages.forEach(msg => {
			const cell = sqdCells.find(c => c.getAttribute("id") === msg.id);
			const geometry = cell.getElementsByTagName("mxGeometry")[0];
			const mxPoints = geometry.getElementsByTagName("mxPoint");

			let sourcePointElem = null;
			let targetPointElem = null;

			for (let i = 0; i < mxPoints.length; i++) {
				const asAttr = mxPoints[i].getAttribute("as");
				if (asAttr === "sourcePoint") sourcePointElem = mxPoints[i];
				if (asAttr === "targetPoint") targetPointElem = mxPoints[i];
			}

			let sourcePoint = sourcePointElem ? {
				x: parseFloat(sourcePointElem.getAttribute("x")),
				y: parseFloat(sourcePointElem.getAttribute("y"))
			} : null;

			let targetPoint = targetPointElem ? {
				x: parseFloat(targetPointElem.getAttribute("x")),
				y: parseFloat(targetPointElem.getAttribute("y"))
			} : null;

			msg.sourcePoint = sourcePoint;
			msg.targetPoint = targetPoint;
		});

		console.log("Lifelines:", lifelines);
		console.log("Messages/Arrows:", messages);
		console.log("Fragments (alt/loop/opt):", fragments);

		return [lifelines, messages, fragments];
	}

	function parseClassDiagram(sqdCells, cdCells) {
		// Find the CD layer id (parent for all class elements)
		const cdLayer = cdCells.find(cell => cell.getAttribute("value") === "CD");
		const cdLayerId = cdLayer ? cdLayer.getAttribute("id") : null;
		if (!cdLayerId) return;

		// Find all class elements whose parent is cdLayerId
		const classes = cdCells
		.filter(cell =>
			cell.getAttribute("parent") === cdLayerId &&
			cell.getAttribute("vertex") === "1"
		)
		.map(cell => {
			const id = cell.getAttribute("id");
			const children = cdCells
				.filter(child => child.getAttribute("parent") === id)
				.map(child => child.getAttribute("id"));

			return {
				id,
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				children,
				geometry: cell.getElementsByTagName("mxGeometry")[0],
			};
		});
		console.log("classes")
		console.log(classes)

		// Helper to get absolute position of a cell by summing up parent geometries
		function getAbsolutePosition(cell) {
			let x = 0, y = 0;
			let current = cell;
			while (current) {
				const geoElem = current.geometry;
				if (geoElem) {
					x += parseFloat(geoElem.getAttribute("x")) || 0;
					y += parseFloat(geoElem.getAttribute("y")) || 0;
				}
				const parentId = current.parent;
				if (!parentId) break;
				current = cdCells.find(c => c.getAttribute("id") === parentId);
			}
			return { x, y };
		}

		// Helper to check if a point is inside a class with optional padding
		function pointInClass(point, classRect, padding = 10) {
			return point.x >= classRect.x - padding &&
				point.x <= classRect.x + classRect.width + padding &&
				point.y >= classRect.y - padding &&
				point.y <= classRect.y + classRect.height + padding;
		}

		// Extract arrows (edges) from class diagram
		var classArrows = cdCells.filter(cell =>
			cell.getAttribute("edge") === "1"
		).map(cell => {
			const geometry = cell.getElementsByTagName("mxGeometry")[0];
			let sourcePoint = null;
			let targetPoint = null;

			if (geometry) {
				const mxPoints = geometry.getElementsByTagName("mxPoint");
				for (let i = 0; i < mxPoints.length; i++) {
					const asAttr = mxPoints[i].getAttribute("as");
					if (asAttr === "sourcePoint") sourcePoint = {
						x: parseFloat(mxPoints[i].getAttribute("x")),
						y: parseFloat(mxPoints[i].getAttribute("y"))
					};
					if (asAttr === "targetPoint") targetPoint = {
						x: parseFloat(mxPoints[i].getAttribute("x")),
						y: parseFloat(mxPoints[i].getAttribute("y"))
					};
				}
			}

			let source = cell.getAttribute("source");
			let target = cell.getAttribute("target");

			// If source or target not found by id, try to find by proximity to arrow endpoints
			if ((!source || !target) && (sourcePoint && targetPoint)) {
				for (const classElem of classes) {
					const geoElem = classElem.geometry;
					if (!geoElem) continue;
					const absPos = getAbsolutePosition(classElem);
					const classRect = {
						x: absPos.x,
						y: absPos.y,
						width: parseFloat(geoElem.getAttribute("width")) || 0,
						height: parseFloat(geoElem.getAttribute("height")) || 0
					};

					if (!source && pointInClass(sourcePoint, classRect)) {
						source = classElem.id;
					}
					if (!target && pointInClass(targetPoint, classRect)) {
						target = classElem.id;
					}
					if (source && target) break;
				}
			}

			return {
				id: cell.getAttribute("id"),
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				source: source,
				target: target,
				style: cell.getAttribute("style") || ""
			};
		});

		console.log("CD classes:\n", classes);
		console.log("CD relations:\n", classArrows);

		return [classes, classArrows];
	}

	// Get all elements in diagramType (= SqD / CD) layer
	function getDiagramCells(cells, diagramType) {
		const layer = cells.find(cell => cell.getAttribute("value") === diagramType);
		if (!layer) {
			console.error(`No diagram layer for ${diagramType} found in XML.`);
			return [];
		}
		const layerId = layer.getAttribute("id");
		const descendantIds = new Set();
		function collectDescendants(parentId) {
			cells.forEach(cell => {
				if (cell.getAttribute("parent") === parentId) {
					const id = cell.getAttribute("id");
					if (!descendantIds.has(id)) {
						descendantIds.add(id);
						collectDescendants(id);
					}
				}
			});
		}
		collectDescendants(layerId);

		return cells.filter(cell => {
			// Always include the layer itself
			if (cell.getAttribute("id") === layerId) {
				return true;
			}

			// Only process descendants
			if (!descendantIds.has(cell.getAttribute("id"))) {
				return false;
			}

			// Check visibility
			const isVisible = cell.getAttribute("visible") !== "0";

			// Check dimensions
			const geoElem = cell.getElementsByTagName("mxGeometry")[0];
			const hasPositiveDimensions = geoElem &&
				parseFloat(geoElem.getAttribute("width")) > 0 &&
				parseFloat(geoElem.getAttribute("height")) > 0;

			// Filter based on the condition: visible OR has positive dimensions
			return isVisible || hasPositiveDimensions;
		});
	}

	// Build the animation script for the animation.js plugin
	function buildAnimationScript(lifelines, messages, cdClasses, cdRelations, cdCells) {
		// Build a map from source to messages for quick traversal
		var sourceMap = new Map();
		var targetSet = new Set();

		messages.forEach(msg => {
			if (!sourceMap.has(msg.source)) {
				sourceMap.set(msg.source, []);
			}
			sourceMap.get(msg.source).push(msg);
			if (msg.target) {
				targetSet.add(msg.target);
			}
		});

		var calls = messages.filter(msg => {
			return !msg.dashed;
		});
		var returns = messages.filter(msg => {
			return msg.dashed;
		}) ;
		
		console.log("Calls", calls);
		console.log("Returns", returns);

		// Traverse the flow in global vertical order, including backward arrows
		var flow = []; 
		var visited = new Set();

		// Collect all messages with valid sourcePoint, sort by sourcePoint.y (top to bottom)
		var sortedMessages = messages
			.filter(msg => msg.sourcePoint)
			.sort((a, b) => {
				return a.sourcePoint.x - b.sourcePoint.x && a.sourcePoint.y - b.sourcePoint.y
			});

		var fragments = new Stack();
		var subFragments = new Stack();
		var visitedFragments = new Set();
		var visitedSubFragments = new Set();

		sortedMessages.forEach(msg => {
			if (!visited.has(msg.id)) {
				if (msg.fragment !== "") { // TODO zatial iba pre alt, dat to do funkcii ptm aj pre loop (3x sa bude opakovat) a opt (? idk asi budeme ukazovat ze plati)
					if (fragments.length === 0 && subFragments.length === 0) {
						console.log("prazdne stacky")
						fragments.push(msg.fragment);
						subFragments.push(msg.subFragment);
						flow.push({
							id: msg.id,
							label: msg.label,
							matchedMethodId: msg.matchedMethodId,
							source: msg.source,
							target: msg.target,
							fragment: msg.fragment,
							subFragment: msg.subFragment,
						});
						visited.add(msg.id);
					}
					else {
						if (msg.fragment === fragments.peek()) {
							// console.log("msg.fragment === fragments.peek()")
							if (msg.subFragment === subFragments.peek()) { // animate only objects in first subfragment
								// console.log("msg.subFragment === subFragments.peek()")
								flow.push({
									id: msg.id,
									label: msg.label,
									matchedMethodId: msg.matchedMethodId,
									source: msg.source,
									target: msg.target,
									fragment: msg.fragment,
									subFragment: msg.subFragment,
								});
								visited.add(msg.id);
							}
							else {
								// console.log("NIE msg.subFragment === subFragments.peek(); nebude sa animovat")
								visited.add(msg.id);
							}
						}
						else if (msg.fragmentParent === subFragments.peek()) { // vnorene ?? idk ci je to dobre
							// console.log("vnorene");
							fragments.push(msg.fragment);
							subFragments.push(msg.subFragment);
							flow.push({
								id: msg.id,
								label: msg.label,
								matchedMethodId: msg.matchedMethodId,
								source: msg.source,
								target: msg.target,
								fragment: msg.fragment,
								subFragment: msg.subFragment,
							});
							visited.add(msg.id);
						}
						else {
							visitedFragments.add(fragments.pop());
							visitedSubFragments.add(subFragments.pop());
							fragments.push(msg.fragment);
							subFragments.push(msg.subFragment);
							flow.push({
								id: msg.id,
								label: msg.label,
								matchedMethodId: msg.matchedMethodId,
								source: msg.source,
								target: msg.target,
								fragment: msg.fragment,
								subFragment: msg.subFragment,
							});
							visited.add(msg.id);
						}
					}
				}
				else {
					while (fragments.length > 0) {
						visitedFragments.add(fragments.pop());
						visitedSubFragments.add(subFragments.pop());
					}
					flow.push({
						id: msg.id,
						label: msg.label,
						matchedMethodId: msg.matchedMethodId,
						source: msg.source,
						target: msg.target,
						fragment: msg.fragment,
						subFragment: msg.subFragment,
					});
					visited.add(msg.id);
				}
				
			}
		});

		console.log("Sequence Flow (ordered):", flow);
		flow.forEach((msg, idx) => {
			console.log(
				`Step ${idx + 1}: [${msg.id}] "${msg.label}" from ${msg.source || "?"} to ${msg.target || "?"}`
			);
		});

		let animationScript = "";
		const highlighted = new Set();

		function findLifelineByBarId(barId) { 
			const found = lifelines.find(lf => lf.activationBars.some(b => b.id === barId));
			if (!found) {
				console.warn("[generateCustomAnim] buildAnimationScript: No lifeline found for barId", barId);
				return null;
			}
			return found;
		}
		
		// Helper to find a call for a return arrow
		function findMatchingCall(msg) { 
			if (!msg.source || !msg.target) return null;
			const reversed = calls.filter(call =>
				call.source === msg.target &&
				call.target === msg.source
			);
			if (msg.sourcePoint) {
				const above = reversed.filter(call =>
					call.sourcePoint && call.sourcePoint.y < msg.sourcePoint.y
				);
				if (above.length > 0) {
					// Pick the closest one above (max y)
					return above.sort((a, b) => b.sourcePoint.y - a.sourcePoint.y)[0];
				}
			}
			// Fallback: just return the first reversed call if any
			return reversed.length > 0 ? reversed[0] : null;
		}

		// Animation helpers
		function highlightCell(id) {
			animationScript += `animate ${id}\n`;
			highlighted.add(id);
		}
		function highlightArrow(id) {
			animationScript += `roll ${id}\n`;
			highlighted.add(id);
		}
		function unhighlight(id) {
			animationScript += `hide ${id}\n`;
			highlighted.delete(id);
		}
		function wait(ms = 1500) {
			animationScript += `wait ${ms}\n`;
		}
		function addInterDiagramLink(sourceId, targetId) {
			animationScript += `add ${sourceId} ${targetId}\n`;
		}
		function removeInterDiagramLink(sourceId, targetId) {
			animationScript += `remove ${sourceId} ${targetId}\n`;
		}

		const initialLifeline = findLifelineByBarId(flow[0].source);
		const initialActivationBar = flow[0].source;
		const classElement = initialLifeline.matchedClassId;
		const methodElement = flow[0].matchedMethodId;

		// Animate initial lifeline and activation bar
		if (initialLifeline.id && !highlighted.has(initialLifeline.id)) {
			highlightCell(initialLifeline.id);
		}
		if (initialActivationBar && !highlighted.has(initialActivationBar)) {
			highlightCell(initialActivationBar);
		}
		if (classElement && !highlighted.has(classElement)) {
			highlightCell(classElement);
		}
		if (methodElement && !highlighted.has(methodElement)) {
			highlightCell(methodElement);
		}
		wait();

		var frag = [];

		flow.forEach((msg) => {
			const sourceLifeline = findLifelineByBarId(msg.source);
			const targetLifeline = findLifelineByBarId(msg.target);

			if (msg.fragment !== "") { // TODO ani toto neviem ci je ok
				frag.push(msg.fragment);
				animateFragment(msg.fragment);
			}
			if (calls.some(call => call.id === msg.id)) {
				animateCall(msg, sourceLifeline, targetLifeline);
			} else if (returns.some(ret => ret.id === msg.id)) {
				animateReturn(msg, sourceLifeline, targetLifeline, frag);
			}
		});

		// Animate a fragment
		function animateFragment(fragment) {
			if (!highlighted.has(fragment)) {
				highlightCell(fragment);
			}
			wait();			
		}

		// Animate a call
		function animateCall(msg, sourceLifeline, targetLifeline) {
			if (!highlighted.has(msg.id)) { 									// highlight sipky v SqD
				highlightArrow(msg.id);
			}
			if (sourceLifeline.matchedClassId && !highlighted.has(sourceLifeline.matchedClassId)) { // highlight source triedy v CD
				highlightCell(sourceLifeline.matchedClassId);
			}
			if (msg.matchedMethodId && !highlighted.has(msg.matchedMethodId)) { // highlight metody v CD
				highlightCell(msg.matchedMethodId);
			}
			if (msg.matchedMethodId && msg.id) {								// zlta sipka medzi metodou v CD a sipkou v SqD
				addInterDiagramLink(msg.matchedMethodId, msg.id);
			}
			const relation = findRelationBetweenClasses(sourceLifeline.matchedClassId, targetLifeline.matchedClassId);
			if (relation && !highlighted.has(relation.id)) { 					// highlight sipky medzi triedami v CD
				highlightArrow(relation.id);
			}
			wait();
			if (targetLifeline.id && !highlighted.has(targetLifeline.id)) {		// highlight lifeline bloku v SqD
				highlightCell(targetLifeline.id);
			}
			if (msg.target && !highlighted.has(msg.target)) {					// highlight lifeline bloku v SqD
				highlightCell(msg.target);
			}
			if (targetLifeline.matchedClassId && !highlighted.has(targetLifeline.matchedClassId)) { // highlight target triedy v CD
				highlightCell(targetLifeline.matchedClassId);
			}
			if (targetLifeline.matchedClassId && targetLifeline.id) { 			// zlta sipka medzi triedou v CD a lifeline blokom v SqD
				addInterDiagramLink(targetLifeline.matchedClassId, targetLifeline.id);
			}
			wait();
		}

		// Animate a return step
		function animateReturn(msg, sourceLifeline, targetLifeline, frag) {
			const matchingCall = findMatchingCall(msg);
			if (!highlighted.has(msg.id)) { 								// highlight return sipky v SqD
				highlightArrow(msg.id);
			}
			wait();
			if (msg.fragment !== "") {
				var fragPop = frag.pop()
				if (frag.length === 0) {
					unhighlight(fragPop)
				}
			}
			if (matchingCall.matchedMethodId && highlighted.has(matchingCall.matchedMethodId)) { // UNhighlight metody v CD
				unhighlight(matchingCall.matchedMethodId);
			}
			if (matchingCall.id && highlighted.has(matchingCall.id)) { 		// UNhighlight sipky ktora predstavuje volanie metody v SqD 
				unhighlight(matchingCall.id);
			}
			if (matchingCall.matchedMethodId && matchingCall.id) { 			// zmaze zltu sipku medzi metodou v CD a sipkou v SqD
				removeInterDiagramLink(matchingCall.matchedMethodId, matchingCall.id);
			}
			if (msg.source && highlighted.has(msg.source)) { 				// UNhighlight activation baru v SqD
				unhighlight(msg.source);
			}
			if (sourceLifeline.id && highlighted.has(sourceLifeline.id) && !hasHighlightedActivationBar(sourceLifeline.id)) { 	// UNhighlight lifeline bloku v SqD
				unhighlight(sourceLifeline.id);
			}
			if (sourceLifeline.matchedClassId && !hasHighlightedMethod(sourceLifeline.matchedClassId)) { // UNhighlight triedy v CD ak nema ziadnu vysvietenu metodu
				unhighlight(sourceLifeline.matchedClassId);
				if (sourceLifeline.matchedClassId && sourceLifeline.id) { 	// zmaze zltu sipku medzi triedou v CD a lifeline blokom v SqD
					removeInterDiagramLink(sourceLifeline.matchedClassId, sourceLifeline.id);
				}
			}
			if (highlighted.has(msg.id)) { 									// UNhighlight return sipky v SqD
				unhighlight(msg.id);
			}
			const relation = findRelationBetweenClasses(targetLifeline.matchedClassId, sourceLifeline.matchedClassId);
			if (relation && highlighted.has(relation.id)) {
				unhighlight(relation.id);									// UNhighlight sipky medzi triedami v CD
			}
			wait();
		}

		// Animate initial source lifeline block
		if (initialLifeline.id && highlighted.has(initialLifeline.id)) {
			unhighlight(initialLifeline.id);
		}
		if (initialActivationBar && highlighted.has(initialActivationBar)) {
			unhighlight(initialActivationBar);
		}

		console.log("=== Animation Script ===\n" + animationScript);
		return animationScript;

		// Helper: Check if a class has any highlighted elements inside
		function hasHighlightedMethod(classId) {
			const cdClass = cdClasses.filter(c => c.id === classId)[0];
			for (const method of cdClass.children) {
				if (highlighted.has(method)) {
					return true;
				}
			}
			return false;
		}

		// Helper: Check if a lifeline has any highlighted activation bars
		function hasHighlightedActivationBar(lifelineId) {
			const lifeline = lifelines.filter(l => l.id === lifelineId)[0];
			for (const activationBar of lifeline.activationBars) {
				if (highlighted.has(activationBar.id)) {
					return true;
				}
			}
			return false;
		}

		function findRelationBetweenClasses(sourceId, targetId) {
			if (!sourceId || !targetId) {
				return;
			}
			return cdRelations.find(r => r.source === sourceId && r.target === targetId);
			// TODO hladat ked tak aj opacne
		}
	}

	editorUi.actions.addAction('generateCustomAnim', function() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json'; // Accept only JSON files

		input.addEventListener('change', function () {
			const file = input.files[0];
			if (!file) return;

			const reader = new FileReader();

			reader.onload = function (e) {
				var fileJson;
				try {
					fileJson = JSON.parse(e.target.result); 
				} catch (err) {
					alert('Invalid JSON file.');
					console.error(err);
				}
				const animation = generateAnimation(fileJson);

				// Save as a text file (one label per line)
				const blob = new Blob([animation], { type: 'text/plain' });
				const a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = 'animation.txt';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			};
			reader.readAsText(file); 
		});

		input.click();
	});

	var menu = editorUi.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu, parent){
		oldFunct.apply(this, arguments);
		editorUi.menus.addMenuItems(menu, ['-', '', 'generateCustomAnim'], parent);
	};
});


class Stack {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items[this.items.length - 1];
  }
}
