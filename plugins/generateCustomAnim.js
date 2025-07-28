/**
 * vytvori animaciu pre class a sekvencny diagram, animuje aj sipky medzi classami 
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('generateCustomAnim=Generate Custom Animation...');

	function generateAnimation() {
		// Function to extract XML from the current diagram
		var xml = editorUi.getFileData();
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(xml, "text/xml");
	       
		console.log("[generateCustomAnim] parseDiagramXml: parsed XML document\n", xml);

		// Find all mxCell elements
		var cells = Array.from(xmlDoc.getElementsByTagName("mxCell"));

		const sqdCells = getDiagramCells(cells, "SqD")  // SqD - name of layer for sequence diagram 
		const cdCells  = getDiagramCells(cells, "CD");   //  CD - name of layer for class diagram
		
		const [lifelines, sqdMessages] = parseSequenceDiagram(sqdCells, cdCells); 
		const cdRelations = parseClassDiagram(sqdCells, cdCells);
		
		var animationScript = buildAnimationScript(lifelines, sqdMessages, cdRelations, cdCells, cells);
	
		return animationScript;
	}

	function parseSequenceDiagram(sqdCells, cdCells) {		
		// Extract lifelines from cells
		function extractLifelines(cells, getAbsolutePosition) {
			// Helper: Compute absolute position for a cell by summing up parent geometries
			function getAbsolutePosition(cell) {
				let x = 0, y = 0;
				let current = cell;
				while (current) {
					const geoElem = current.getElementsByTagName("mxGeometry")[0];
					if (geoElem) {
						x += parseFloat(geoElem.getAttribute("x")) || 0;
						y += parseFloat(geoElem.getAttribute("y")) || 0;
					}
					const parentId = current.getAttribute("parent");
					if (!parentId) break;
					current = cells.find(c => c.getAttribute("id") === parentId);
				}
				return { x, y };
			}

			return cells.filter(cell =>
				cell.getAttribute("style") && cell.getAttribute("style").includes("shape=umlLifeline")
			).map(cell => {
				const rectangles = cells
					.filter(c =>
						c.getAttribute("vertex") === "1" &&
						c.getAttribute("parent") === cell.getAttribute("id") &&
						(!c.getAttribute("style") || !c.getAttribute("style").includes("shape=umlLifeline"))
					)
					.map(c => {
						const geoElem = c.getElementsByTagName("mxGeometry")[0];
						let width = 0, height = 0;
						if (geoElem) {
							width = parseFloat(geoElem.getAttribute("width")) || 0;
							height = parseFloat(geoElem.getAttribute("height")) || 0;
						}
						const abs = getAbsolutePosition(c);
						return {
							id: c.getAttribute("id"),
							x: abs.x,
							y: abs.y,
							width,
							height
						};
					});
				return {
					id: cell.getAttribute("id"),
					label: cell.getAttribute("value"),
					parent: cell.getAttribute("parent"),
					rectangles: rectangles
				};
			});
		}

		// Assign source and target lifeline IDs based on sourcePoint and targetPoint
		function assignMessageEndpoints(messages, lifelines) {
			// Helper: Check if point is inside a rectangle with optional padding
			function pointInRect(point, rect, padding = 20) {
				return point.x >= rect.x - padding &&
					point.x <= rect.x + rect.width + padding &&
					point.y >= rect.y - padding &&
					point.y <= rect.y + rect.height + padding;
			}

			messages.forEach(msg => {
				if (!msg.source && msg.sourcePoint) {
					for (const lf of lifelines) {
						for (const rect of lf.rectangles) {
							if (rect && pointInRect(msg.sourcePoint, rect)) {
								msg.source = rect.id;
								break;
							}
						}
						if (msg.source) break;
					}
				}
				if (!msg.target && msg.targetPoint) {
					for (const lf of lifelines) {
						for (const rect of lf.rectangles) {
							if (rect && pointInRect(msg.targetPoint, rect)) {
								msg.target = rect.id;
								break;
							}
						}
						if (msg.target) break;
					}
				}
			});
		}

		// Extract lifelines (umlLifeline in style) from sqdCells
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
			dashed: cell.getAttribute("style").includes("dashed=1")
		}));

		// Match messages to methods in matched class
		messages.forEach(msg => {
			const msgLabel = msg.label.replace(/\s*\([^)]*\)/, '').trim()

			const match = cdCells.find(cell => cell.getAttribute("value") && msgLabel && cell.getAttribute("value").includes(msgLabel));
			if (match) {
				msg.matchedClassId = match.getAttribute("id");
			}
		});

		// Extract sourcePoint and targetPoint for each message from mxGeometry or mxPoint
		messages.forEach(msg => {
			var cell = sqdCells.find(c => c.getAttribute("id") === msg.id);
			if (!cell) {
				console.warn("[generateCustomAnim] parseDiagramXml: No cell found for message id", msg.id);
				return;
			}

			var geometry = cell.getElementsByTagName("mxGeometry")[0];
			if (!geometry) {
				console.warn("[generateCustomAnim] parseDiagramXml: No geometry found for message id", msg.id);
				return;
			}

			var mxPoints = geometry.getElementsByTagName("mxPoint");
			let sourcePointElem = null, targetPointElem = null;
			for (let i = 0; i < mxPoints.length; i++) {
				const asAttr = mxPoints[i].getAttribute("as");
				if (asAttr === "sourcePoint") sourcePointElem = mxPoints[i];
				if (asAttr === "targetPoint") targetPointElem = mxPoints[i];
			}

			msg.sourcePoint = sourcePointElem ? {
				x: parseFloat(sourcePointElem.getAttribute("x")),
				y: parseFloat(sourcePointElem.getAttribute("y"))
			} : null;

			msg.targetPoint = targetPointElem ? {
				x: parseFloat(targetPointElem.getAttribute("x")),
				y: parseFloat(targetPointElem.getAttribute("y"))
			} : null;

			// Fallback to geometry x,y if sourcePoint or targetPoint is null
			if (!msg.sourcePoint && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				msg.sourcePoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}
			if (!msg.targetPoint && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				msg.targetPoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}
		});

		assignMessageEndpoints(messages, lifelines);


		// Find the starting lifeline: no incoming arrow from the left
		function isIncomingFromLeft(msg, lifelineId) {
			if (msg.target !== lifelineId) return false;
			if (!msg.sourcePoint || !msg.targetPoint) return false;
			return msg.sourcePoint.x < msg.targetPoint.x;
		}

		var lifelineIds = lifelines.map(lf => lf.id);
		var lifelineHasIncomingLeft = {};
		lifelineIds.forEach(id => lifelineHasIncomingLeft[id] = false);

		messages.forEach(msg => {
			lifelineIds.forEach(id => {
				if (isIncomingFromLeft(msg, id)) {
					lifelineHasIncomingLeft[id] = true;
				}
			});
		});


		console.log("Lifelines:", lifelines);
		console.log("Messages/Arrows:", messages);

		return [lifelines, messages]; 
	}

	function parseClassDiagram(sqdCells, cdCells) {
		// Find the CD layer id (parent for all class blocks)
		const cdLayer = cdCells.find(cell => cell.getAttribute("value") === "CD");
		const cdLayerId = cdLayer ? cdLayer.getAttribute("id") : null;
		if (!cdLayerId) return;

		// Find all class elements whose parent is cdLayerId
		const classElements = cdCells.filter(cell =>
			cell.getAttribute("parent") === cdLayerId &&
			cell.getAttribute("vertex") === "1"
		);

		// Helper to get absolute position of a cell by summing up parent geometries
		function getAbsolutePosition(cell) {
			let x = 0, y = 0;
			let current = cell;
			while (current) {
				const geoElem = current.getElementsByTagName("mxGeometry")[0];
				if (geoElem) {
					x += parseFloat(geoElem.getAttribute("x")) || 0;
					y += parseFloat(geoElem.getAttribute("y")) || 0;
				}
				const parentId = current.getAttribute("parent");
				if (!parentId) break;
				current = cdCells.find(c => c.getAttribute("id") === parentId);
			}
			return { x, y };
		}

		// Helper to find class element by id
		function findClassElementForId(id) {
			const cell = cdCells.find(c => c.getAttribute("id") === id);
			if (!cell) return;
			if (cell.getAttribute("parent") === cdLayerId) {
				return id;
			}

			return findClassElementForId(cell.getAttribute("parent"));
		}

		// Helper to check if a point is inside a rectangle with optional padding
		function pointInRect(point, rect, padding = 10) {
			return point.x >= rect.x - padding &&
				point.x <= rect.x + rect.width + padding &&
				point.y >= rect.y - padding &&
				point.y <= rect.y + rect.height + padding;
		}

		// Extract arrows (edges) from class diagram cells
		var classArrows = cdCells.filter(cell =>
			cell.getAttribute("edge") === "1"
		).map(cell => {
			// Get geometry element for arrow
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

			// Fallback to geometry x,y if sourcePoint or targetPoint is null
			if (!sourcePoint && geometry && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				sourcePoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}
			if (!targetPoint && geometry && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				targetPoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}

			// Find source and target class elements by id or by proximity to arrow endpoints
			let sourceElem = findClassElementForId(cell.getAttribute("source"));
			let targetElem = findClassElementForId(cell.getAttribute("target"));

			// If source or target not found by id, try to find by proximity to arrow endpoints
			if ((!sourceElem || !targetElem) && (sourcePoint && targetPoint)) {
				for (const classElem of classElements) {
					const geoElem = classElem.getElementsByTagName("mxGeometry")[0];
					if (!geoElem) continue;
					const absPos = getAbsolutePosition(classElem);
					const rect = {
						x: absPos.x,
						y: absPos.y,
						width: parseFloat(geoElem.getAttribute("width")) || 0,
						height: parseFloat(geoElem.getAttribute("height")) || 0
					};

					if (!sourceElem && pointInRect(sourcePoint, rect)) {
						sourceElem = classElem.getAttribute("id");
					}
					if (!targetElem && pointInRect(targetPoint, rect)) {
						targetElem = classElem.getAttribute("id");
					}
					if (sourceElem && targetElem) break;
				}
			}

			return {
				id: cell.getAttribute("id"),
				label: cell.getAttribute("value"),
				parent: cell.getAttribute("parent"),
				// Use source and target class element ids if found, else fallback to original
				source: sourceElem ? sourceElem : cell.getAttribute("source"),
				target: targetElem ? targetElem : cell.getAttribute("target"),
				style: cell.getAttribute("style") || ""
			};
		});

		// For debugging, log class arrows with source and target classes
		console.log("[generateCustomAnim] Class diagram arrows with source/target classes:\n", classArrows);
		return classArrows;
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
		return cells.filter(cell =>
			cell.getAttribute("id") === layerId || descendantIds.has(cell.getAttribute("id"))
		);
	}

	// Build the animation script for the animation.js plugin
	function buildAnimationScript(lifelines, messages, cdRelations, cdCells, cells) {
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
			.sort((a, b) => a.sourcePoint.y - b.sourcePoint.y);

		sortedMessages.forEach(msg => {
			if (!visited.has(msg.id)) {
				flow.push({
					id: msg.id,
					label: msg.label,
					matchedClassId: msg.matchedClassId,
					source: msg.source,
					target: msg.target
				});
				visited.add(msg.id);
			}
		});

		console.log("Sequence Flow (ordered by connectivity):", flow);
		flow.forEach((msg, idx) => {
			console.log(
				`Step ${idx + 1}: [${msg.id}] "${msg.label}" from ${msg.source || "?"} to ${msg.target || "?"}`
			);
		});

		let animationScript = "";
		const highlighted = new Set();

		function findLifelineByRectId(rectId) {
			const found = lifelines.find(lf => lf.rectangles.some(r => r.id === rectId));
			if (!found) {
				console.warn("[generateCustomAnim] buildAnimationScript: No lifeline found for rectId", rectId);
				return null;
			}
			return found;
		}
		
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

		const initialLfParent = findLifelineByRectId(flow[0].source);
		const initialLf = flow[0].source;
		const classElement = flow[0].matchedClassId;

		// Animate initial source lifeline block
		if (initialLfParent.id && !highlighted.has(initialLfParent.id)) {
			highlightCell(initialLfParent.id);
		}
		if (initialLf && !highlighted.has(initialLf)) {
			highlightCell(initialLf);
		}
		if (classElement && !highlighted.has(classElement)) {
			highlightCell(classElement);
		}
		wait();

		flow.forEach((msg) => {
			const sourceParent = findLifelineByRectId(msg.source);
			const targetParent = findLifelineByRectId(msg.target);

			if (calls.some(call => call.id === msg.id)) {
				animateCallStep(msg, sourceParent, targetParent);
			} else if (returns.some(ret => ret.id === msg.id)) {
				animateReturnStep(msg, sourceParent, targetParent);
			}
		});

		// Animate a call step
		function animateCallStep(msg, sourceParent, targetParent) {
			if (!highlighted.has(msg.id)) {
				highlightArrow(msg.id);
			}
			if (msg.matchedClassId && !highlighted.has(msg.matchedClassId)) {
				highlightCell(msg.matchedClassId);
			}
			const relation = findRelationBetweenClasses(sourceParent.matchedClassId, targetParent.matchedClassId);
			if (relation && !highlighted.has(relation.id)) {
				highlightArrow(relation.id);
			}
			wait();
			if (targetParent.id && !highlighted.has(targetParent.id)) {
				highlightCell(targetParent.id);
			}
			if (msg.target && !highlighted.has(msg.target)) {
				highlightCell(msg.target);
			}
			if (targetParent.matchedClassId && !highlighted.has(targetParent.matchedClassId)) {
				highlightCell(targetParent.matchedClassId);
			}
			
			// // Add a new edge (line) between msg.matchedClassId and msg.id for each message  // TODO na pridanie ciary? 
			// const newEdgeId = "custom_edge_" + msg.matchedClassId + "_" + msg.id;
			// // Find the CD layer as parent
			// const cdLayer = cells.find(cell => cell.getAttribute("value") === "CD");
			// const parentId = cdLayer ? cdLayer.getAttribute("id") : null;
			// // Create the new mxCell element
			// const edgeElem = xmlDoc.createElement("mxCell");
			// edgeElem.setAttribute("id", newEdgeId);
			// edgeElem.setAttribute("edge", "1");
			// edgeElem.setAttribute("source", msg.matchedClassId);
			// edgeElem.setAttribute("target", msg.id);
			// if (parentId) edgeElem.setAttribute("parent", parentId);
			// // Optionally, set a style for visibility
			// edgeElem.setAttribute("style", "strokeColor=#FF0000;endArrow=block;");
			// // Add geometry for the edge
			// const geomElem = xmlDoc.createElement("mxGeometry");
			// geomElem.setAttribute("relative", "1");
			// geomElem.setAttribute("as", "geometry");
			// edgeElem.appendChild(geomElem);
			// // Append to the XML root
			// xmlDoc.documentElement.appendChild(edgeElem);

			wait();
		}

		// Animate a return step
		function animateReturnStep(msg, sourceParent, targetParent) {
			const matchingCall = findMatchingCall(msg);
			if (!highlighted.has(msg.id)) {
				highlightArrow(msg.id);
			}
			wait();
			if (matchingCall.matchedClassId && highlighted.has(matchingCall.matchedClassId)) {
				unhighlight(matchingCall.matchedClassId);
			}
			if (matchingCall.id && highlighted.has(matchingCall.id)) {
				unhighlight(matchingCall.id);
			}
			if (sourceParent.id && highlighted.has(sourceParent.id)) {
				unhighlight(sourceParent.id);
			}
			if (msg.source && highlighted.has(msg.source)) {
				unhighlight(msg.source);
			}
			if (sourceParent.matchedClassId && isClassEmpty(sourceParent.matchedClassId)) {
				unhighlight(sourceParent.matchedClassId);
			}
			if (highlighted.has(msg.id)) {
				unhighlight(msg.id);
			}
			const relation = findRelationBetweenClasses(targetParent.matchedClassId, sourceParent.matchedClassId);
			if (relation && highlighted.has(relation.id)) {
				unhighlight(relation.id);
			}
			wait();
		}

		// Animate initial source lifeline block
		if (initialLfParent.id && highlighted.has(initialLfParent.id)) {
			unhighlight(initialLfParent.id);
		}
		if (initialLf && highlighted.has(initialLf)) {
			unhighlight(initialLf);
		}

		console.log("=== Animation Script ===\n" + animationScript);
		return animationScript;

		// Helper: Check if a class has any highlighted elements inside (excluding specified ids)
		function isClassEmpty(classId) {
			for (const msg of messages) {
				const method = cdCells.find(c => c.getAttribute("id") === msg.matchedClassId);
				if (method && method.getAttribute("parent") === classId && highlighted.has(method.getAttribute("id") )) {
					console.log("return FALSE")
					return false;
				}
			}
			console.log("return TRUE")
			return true;
		}

		function findRelationBetweenClasses(sourceId, targetId) {
			console.log("find arrow between classes s: ", sourceId, "t: ", targetId);
			if (!sourceId || !targetId) {
				return;
			}

			console.log(cdRelations);
			return cdRelations.find(r => r.source === sourceId && r.target === targetId);
		}
	}

	editorUi.actions.addAction('generateCustomAnim', function() {
		var animation = generateAnimation();

        // // Save as a text file (one label per line)
		var blob = new Blob([animation], {type: 'text/plain'});
		var a = document.createElement('a');
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
