/**
 * vytvori animaciu pre class a sekvencny diagram, animuje aj sipky medzi classami 
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('generateCustomAnim=Generate Custom Animation...');

	function generateAnimation(fileJson) {
		const { xmlDoc, sqdCells, cdCells, allCells } = parseDiagramXml(editorUi);
		
		console.log("fileJson: \n", fileJson);

		const [lifelines, sqdMessages, fragments] = parseSequenceDiagram(sqdCells, cdCells, allCells, fileJson);
		const [cdClasses, cdRelations] = parseClassDiagram(sqdCells, cdCells);

		var animationScript = buildAnimationScript(lifelines, sqdMessages, cdClasses, cdRelations, cdCells, allCells);
	
		return animationScript;
	}

	function parseDiagramXml(editorUi) {
		var xml = editorUi.getFileData();
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(xml, "text/xml");
	       
		console.log("parseDiagramXml: parsed XML document\n", xml);

		var allCells = Array.from(xmlDoc.getElementsByTagName("mxCell"));

		const sqdCells = getDiagramCells(allCells, "SqD")   // SqD - name of layer for sequence diagram
		const cdCells  = getDiagramCells(allCells, "CD");   //  CD - name of layer for class diagram

		allCells = allCells.map(cell => {
			return {
				id: cell.getAttribute("id"),
				raw: cell,
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				is_edge: cell.getAttribute('edge') == '1',
				is_vertex: cell.getAttribute('vertex') == '1',
				geometry: cell.getElementsByTagName("mxGeometry")[0],
			};
		});

		return { xmlDoc, sqdCells, cdCells, allCells };
	}

	function getClosestLifeline(activationBar, lifelines, allCells) {
		let abCoordinates = {
			'id': activationBar.id,
			'x': activationBar.geometry.getAttribute('x'),
			'y': activationBar.geometry.getAttribute('y'),
			'width': parseFloat(activationBar.geometry.getAttribute('width')),
			'height': parseFloat(activationBar.geometry.getAttribute('height'))
		};

		let abAbsoluteCoordinates = getAbsolutePosition(activationBar, allCells);
		abCoordinates.x = abAbsoluteCoordinates.x;
		abCoordinates.y = abAbsoluteCoordinates.y;

		let abMiddlePoint = {
			'x': abCoordinates.x + abCoordinates.width/2,
			'y': abCoordinates.y + abCoordinates.height/2
		};

		let lifelinesCoordinates = lifelines.map(lf => {
			let lfCoordinates = {
				'id': lf.id,
				'x': lf.geometry.getAttribute('x'),
				'y': lf.geometry.getAttribute('y'),
				'width': parseFloat(lf.geometry.getAttribute('width')),
				'height': parseFloat(lf.geometry.getAttribute('height'))
			};

			let lfAbsoluteCoordinates = getAbsolutePosition(lf, allCells);
			lfCoordinates.x = lfAbsoluteCoordinates.x;
			lfCoordinates.y = lfAbsoluteCoordinates.y;

			return lfCoordinates;
		});

		lifelinesCoordinates.sort((a,b) => {
			let aDist = distanceOfLinePointAndActivationBar(abMiddlePoint, a);
			let bDist = distanceOfLinePointAndActivationBar(abMiddlePoint, b);

			if (aDist < bDist) { return -1; }
			else if (aDist > bDist) { return 1; }

			return 0;
		});

		return lifelinesCoordinates[0];
	}

	// Helper to extract lifeline with its activation bars
	function extractLifelines(sqdCells, allCells) {			
		var lifelines = sqdCells.filter(cell =>
			cell.getAttribute("style") && cell.getAttribute("style").includes("shape=umlLifeline")
		).map(cell => {
			return {
				id: cell.getAttribute("id"),
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				geometry: cell.getElementsByTagName("mxGeometry")[0],
				activationBars: []
			};
		});

		const activationBars
			= allCells
				.map(c => c.raw)
				.filter(c =>
					c.getAttribute("vertex") === "1" 
					&& c.getAttribute("style").includes("targetShapes=umlLifeline")
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
						parent: c.getAttribute("parent"),
						x: x,
						y: y,
						width: width,
						height: height,
						geometry: geoElem,
						lifeline: null
					};
				});

			activationBars.forEach(ab => {
				ab.lifeline = getClosestLifeline(ab, lifelines, allCells).id;
			});

			lifelines.forEach(lf => {
				lf.activationBars = activationBars.filter(ab => ab.lifeline == lf.id)
			});

		return lifelines;
	}

	// Helper to get absolute position of a cell by summing up parent geometries
	function getAbsolutePosition(cell, diagramCells) {
		let x = 0, y = 0;
		let current = cell;
		while (current) {
			const geoElem = current.geometry;
			if (geoElem) {
				x += parseFloat(geoElem.getAttribute("x")) || 0;
				y += parseFloat(geoElem.getAttribute("y")) || 0;
			}
			const parentId = current.parent;
			if (!parentId || parentId == '0') break;
			current = diagramCells.find(c => c.id === parentId);
		}

		return { x, y };
	}

	function getAbsolutePositionOfLine(cell, coordinates, diagramCells) {
		let absolutePosition = { 'x': parseFloat(coordinates['x']), 'y': parseFloat(coordinates['y']) };
		
		let parent_id = cell.parent || cell.getAttribute('parent');
		let parent =  diagramCells.find(c => c.id === parent_id);
		if (parent) {
			let parentAbsolutePosition = getAbsolutePosition(parent, diagramCells);
			absolutePosition['x'] = absolutePosition['x'] + parentAbsolutePosition['x'];
			absolutePosition['y'] = absolutePosition['y'] + parentAbsolutePosition['y'];
		}

		return absolutePosition;
	}


	// Hinted by GPT - How do I calculate distance of a single point to the closest point of a rectangle?
	function clamp(val, min, max) {
		return Math.max(min, Math.min(max, val));
	}

	// Hinted by GPT - How do I calculate distance of a single point to the closest point of a rectangle?
	function distanceOfLinePointAndActivationBar(linePointPosition, activationBarPosition){
		let closestX = clamp(linePointPosition['x'], activationBarPosition['x'], activationBarPosition['x'] + activationBarPosition['width']);
		let closestY = clamp(linePointPosition['y'], activationBarPosition['y'], activationBarPosition['y'] + activationBarPosition['height']);
		let dx = linePointPosition['x'] - closestX;
		let dy = linePointPosition['y'] - closestY;
		let distance = Math.sqrt(dx * dx + dy * dy);
		return distance;
	}

	function estimateClosestActivationBar(cell, lifelines, coordinateName, diagramCells) {
		let closestActivationBar = null;
		let absPositionOfCell = getAbsolutePositionOfLine(cell, getLineCoordinates(cell, coordinateName), diagramCells);

		lifelines.forEach((lf) => {
			lf.activationBars.forEach((ab) => {
				if (!closestActivationBar) {
					closestActivationBar = ab;
				}
				else {
					let currentAbAbsolutePosition = getAbsolutePosition(ab, diagramCells);
					currentAbAbsolutePosition['height'] = ab['height'];
					currentAbAbsolutePosition['width'] = ab['width'];

					let bestAbAbsolutePosition = getAbsolutePosition(closestActivationBar, diagramCells);
					bestAbAbsolutePosition['height'] = closestActivationBar['height'];
					bestAbAbsolutePosition['width'] = closestActivationBar['width'];

					let distanceToCurrentActivationBar = distanceOfLinePointAndActivationBar(absPositionOfCell, currentAbAbsolutePosition);
					let distanceToBestActivationBar = distanceOfLinePointAndActivationBar(absPositionOfCell, bestAbAbsolutePosition);

					if (distanceToCurrentActivationBar < distanceToBestActivationBar) {
						closestActivationBar = ab;
					}
				}
			})
		})

		return closestActivationBar;
	}

	function getLineCoordinates(cell, coordinateName) {
		let a = cell.getElementsByTagName('mxGeometry')[0];
		let b = a.getElementsByTagName('mxPoint');
		let coordinateCell = Array.from(b).filter(el => el.getAttribute("as") == coordinateName)[0];
		let result = { 'x': coordinateCell.getAttribute('x'), 'y': coordinateCell.getAttribute('y') };
		return result;
	}
	
	const fragTypes = ['alt', 'opt', 'loop', 'par'];
	function extractFragmentsAndLinesHierarchy(allCells) {
		let fragCells = allCells.filter(cell => fragTypes.includes(cell.label));
		let fragments = fragCells.map(cell => {
			let absPos = getAbsolutePosition(cell, allCells);
			let fragment = {
				'id': cell.id,
				'value': cell.label,
				'y': absPos['y'],
				'height': cell.geometry.getAttribute('height'),
				'child_areas': allCells.filter(ca => ca.parent == cell.id).map(ca => {
					let childAreaMetadata = {
						'id': ca.id,
						'value': ca.label,
						'y': getAbsolutePosition(ca, allCells)['y'],
						'height': ca.geometry.getAttribute('height'),
						'lines': []
					};
					return childAreaMetadata;
				}),
				'parent': cell.parent
			};
			return fragment;
		});

		let allChildAreaIds = fragments.map(frag => frag['child_areas']).reduce((acc, v) => acc.concat(v), []).map(ca => ca['id']);
		fragments.forEach(frag => {
			frag['parent'] = allChildAreaIds.includes(frag['parent']) ? frag['parent'] : null;
		});

		fragments.sort((a,b) => {
			if (a.y < b.y) {
				return -1;
			} else if (a > b) {
				return 1;
			}
			// a must be equal to b
			return 0;
		});

		let lineCells = allCells.filter(line => line.is_edge).map(line => {
			return {
				'id': line.id,
				'value': line.label,
				'y': getAbsolutePositionOfLine(line, 'targetPoint', allCells)
			};
		});
		lineCells.sort((a,b) => {
			if (a.y < b.y) {
				return -1;
			} else if (a > b) {
				return 1;
			}
			// a must be equal to b
			return 0;
		});

		var found = false;
		lineCells.forEach(line => {
			for(let i = fragments.length - 1; i >= 0; i--) {
				fragments[i]['child_areas'].forEach(ca => {
					if(line['y'] >= ca['y'] && line['y'] <= (ca['y'] + ca['height'])) {
						ca['lines'].append(line);
						found = true;
						return;
					}
				});

				if (found) {
					break;
				}
			}
		});

		return fragments;
	}

	function parseSequenceDiagram(sqdCells, cdCells, allCells, fileJson) {
		const fragments = extractFragmentsAndLinesHierarchy(allCells);

		// Extract lifelines from sqdCells
		var lifelines = extractLifelines(sqdCells, allCells);

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
			source: cell.getAttribute("source") || estimateClosestActivationBar(cell, lifelines, 'sourcePoint', allCells)['id'],
			target: cell.getAttribute("target") || estimateClosestActivationBar(cell, lifelines, 'targetPoint', allCells)['id'],
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
		console.log("classes");
		console.log(classes);

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
					const absPos = getAbsolutePosition(classElem, cdCells);
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
	function buildAnimationScript(lifelines, messages, cdClasses, cdRelations, cdCells, allCells) {
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
				return a.sourcePoint.y - b.sourcePoint.y
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
		function findMatchingCall(msg, allCells) {
			if (!msg.source || !msg.target) return null;

			var rawMsg = allCells.filter(c => c.id == msg.id)[0].raw;
			const returnLine = {
				id: msg.id,
				y: getAbsolutePositionOfLine(rawMsg, getLineCoordinates(rawMsg, "targetPoint"), allCells).y
			};

			const reversed
				= calls.filter(call =>
					call.source === msg.target &&
					call.target === msg.source
				).map(call => {
					var rawCall = allCells.filter(c => c.id == call.id)[0].raw;
					return {
						id: call.id,
						y: getAbsolutePositionOfLine(rawCall, getLineCoordinates(rawCall, "targetPoint"), allCells).y
					}
				});
			if (reversed.length <= 0) { return null; }

			const above = reversed.filter(call => call.y < returnLine.y);
			if (above.length <= 0) { return null; }

			above.sort((a,b) => a.y-b.y);

			var matchingCallId = above[above.length-1].id;
			var matchingCall = calls.filter(call => call.id == matchingCallId)[0];
			return matchingCall;
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
				animateReturn(msg, sourceLifeline, targetLifeline, frag, allCells);
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
		function animateReturn(msg, sourceLifeline, targetLifeline, frag, allCells) {
			const matchingCall = findMatchingCall(msg, allCells);
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
		const animation = generateAnimation();

		// Save as a text file (one label per line)
		const blob = new Blob([animation], { type: 'text/plain' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'animation.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
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
