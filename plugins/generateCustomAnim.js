/**
 * vytvori animaciu pre class a sekvencny diagram, animuje aj sipky medzi classami 
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('generateCustomAnim=Generate Custom Animation...');

	function generateAnimation() {
		const { xmlDoc, sqdCells, cdCells } = parseDiagramXml(editorUi);
		
		const [lifelines, sqdMessages, fragments] = parseSequenceDiagram(sqdCells, cdCells);
		const cdRelations = parseClassDiagram(sqdCells, cdCells);

		// For now, just log the fragments. You can use them as needed downstream.
		console.log("[generateCustomAnim] Sequence fragments:", fragments);
		
		var animationScript = buildAnimationScript(lifelines, sqdMessages, cdRelations, cdCells);
	
		return animationScript;
	}

	function parseDiagramXml(editorUi) {
		var xml = editorUi.getFileData();
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(xml, "text/xml");
	       
		console.log("[generateCustomAnim] parseDiagramXml: parsed XML document\n", xml);

		var cells = Array.from(xmlDoc.getElementsByTagName("mxCell"));

		const sqdCells = getDiagramCells(cells, "SqD")   // SqD - name of layer for sequence diagram
		const cdCells  = getDiagramCells(cells, "CD");   //  CD - name of layer for class diagram

		return { xmlDoc, sqdCells, cdCells };
	}

	function parseSequenceDiagram(sqdCells, cdCells) {
		// Extract alt/loop/opt elements and their children
		function extractFragments(cells) {
			const fragmentTypes = ['alt', 'loop', 'opt'];
			const fragments = [];

			// Helper: recursively collect all descendants of a cell
			function collectChildren(parentId) {
				const children = [];
				cells.forEach(cell => {
					if (cell.getAttribute("parent") === parentId) {
						children.push(cell);
						children.push(...collectChildren(cell.getAttribute("id")));
					}
				});
				return children;
			}

			cells.forEach(cell => {
				const value = (cell.getAttribute("value") || "").toLowerCase();
				if (fragmentTypes.includes(value)) {
					const fragment = {
						id: cell.getAttribute("id"),
						value: value,
						children: collectChildren(cell.getAttribute("id"))
					};
					fragments.push(fragment);
				}
			});
			return fragments;
		}

		const fragments = extractFragments(sqdCells);

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
					.filter(c => {
						const geoElem = c.getElementsByTagName("mxGeometry")[0];
						if (!geoElem) return false;
						const width = parseFloat(geoElem.getAttribute("width")) || 0;
						const height = parseFloat(geoElem.getAttribute("height")) || 0;
						return width > 0 && height > 0;
					})
					.map(c => {
						const geoElem = c.getElementsByTagName("mxGeometry")[0];
						const width = parseFloat(geoElem.getAttribute("width"));
						const height = parseFloat(geoElem.getAttribute("height"));
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


		// Helper: Check if point is inside a rectangle with optional padding
		function pointInRect(point, rect, padding = 20) {
			return point.x >= rect.x - padding &&
				point.x <= rect.x + rect.width + padding &&
				point.y >= rect.y - padding &&
				point.y <= rect.y + rect.height + padding;
		}

		// Helper: Compute absolute position for a point in a cell by summing up parent geometries
		function getAbsolutePoint(cell, point) {
			if (!point) return null;
			let absX = point.x;
			let absY = point.y;
			let current = cell;
			while (current) {
				const geoElem = current.getElementsByTagName("mxGeometry")[0];
				if (geoElem) {
					absX += parseFloat(geoElem.getAttribute("x")) || 0;
					absY += parseFloat(geoElem.getAttribute("y")) || 0;
				}
				const parentId = current.getAttribute("parent");
				if (!parentId) break;
				current = sqdCells.find(c => c.getAttribute("id") === parentId);
			}
			return { x: absX, y: absY };
		}

		messages.forEach(msg => {
			const cell = sqdCells.find(c => c.getAttribute("id") === msg.id);
			if (!cell) {
				console.warn("[generateCustomAnim] parseDiagramXml: No cell found for message id", msg.id);
				return;
			}

			const geometry = cell.getElementsByTagName("mxGeometry")[0];
			if (!geometry) {
				console.warn("[generateCustomAnim] parseDiagramXml: No geometry found for message id", msg.id);
				return;
			}

			const mxPoints = geometry.getElementsByTagName("mxPoint");
			let sourcePointElem = null, targetPointElem = null;
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

			// Fallback to geometry x,y if sourcePoint or targetPoint is null
			if (!sourcePoint && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				sourcePoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}
			if (!targetPoint && geometry.getAttribute("x") && geometry.getAttribute("y")) {
				targetPoint = {
					x: parseFloat(geometry.getAttribute("x")),
					y: parseFloat(geometry.getAttribute("y"))
				};
			}

			msg.sourcePoint = getAbsolutePoint(cell, sourcePoint);
			msg.targetPoint = getAbsolutePoint(cell, targetPoint);

			// Prefer Draw.io reference: if msg.source matches a rectangle's id, assign directly
			if (!msg.source && msg.sourcePoint) {
				let foundByReference = false;
				for (const lf of lifelines) {
					for (const rect of lf.rectangles) {
						if (rect && msg.source && rect.id === msg.source) {
							// Direct reference match
							msg.source = rect.id;
							foundByReference = true;
							break;
						}
					}
					if (foundByReference) break;
				}
				// Fallback: geometric proximity with generous padding
				if (!foundByReference) {
					console.log("not found by reference")
					for (const lf of lifelines) {
						for (const rect of lf.rectangles) {
							const rectCell = sqdCells.find(c => c.getAttribute("id") === rect.id);
							let absRect = rect;
							console.log("if rectCell")
							if (rectCell) {
								let abs = { x: rect.x, y: rect.y };
								let current = rectCell;
								while (current) {
									const geoElem = current.getElementsByTagName("mxGeometry")[0];
									if (geoElem) {
										abs.x += parseFloat(geoElem.getAttribute("x")) || 0;
										abs.y += parseFloat(geoElem.getAttribute("y")) || 0;
									}
									const parentId = current.getAttribute("parent");
									if (!parentId) break;
									current = sqdCells.find(c => c.getAttribute("id") === parentId);
								}
								absRect = {
									...rect,
									x: abs.x,
									y: abs.y
								};
								console.log("absRect")
								console.log(absRect)
								console.log("msg.sourcePoint")
								console.log(msg.sourcePoint)
							}
							// Use a larger padding for fuzzy matching
							if (rect && pointInRect(msg.sourcePoint, absRect, 40)) {
								msg.source = rect.id;
								break;
							}
						}
						if (msg.source) break;
					}
				}
			}
			// Prefer Draw.io reference: if msg.target matches a rectangle's id, assign directly
			if (!msg.target && msg.targetPoint) {
				let foundByReference = false;
				for (const lf of lifelines) {
					for (const rect of lf.rectangles) {
						if (rect && msg.target && rect.id === msg.target) {
							// Direct reference match
							msg.target = rect.id;
							foundByReference = true;
							break;
						}
					}
					if (foundByReference) break;
				}
				// Fallback: geometric proximity with generous padding
				if (!foundByReference) {
					for (const lf of lifelines) {
						for (const rect of lf.rectangles) {
							const rectCell = sqdCells.find(c => c.getAttribute("id") === rect.id);
							let absRect = rect;
							if (rectCell) {
								let abs = { x: rect.x, y: rect.y };
								let current = rectCell;
								while (current) {
									const geoElem = current.getElementsByTagName("mxGeometry")[0];
									if (geoElem) {
										abs.x += parseFloat(geoElem.getAttribute("x")) || 0;
										abs.y += parseFloat(geoElem.getAttribute("y")) || 0;
									}
									const parentId = current.getAttribute("parent");
									if (!parentId) break;
									current = sqdCells.find(c => c.getAttribute("id") === parentId);
								}
								absRect = {
									...rect,
									x: abs.x,
									y: abs.y
								};
							}
							// Use a larger padding for fuzzy matching
							if (rect && pointInRect(msg.targetPoint, absRect, 40)) {
								msg.target = rect.id;
								break;
							}
						}
						if (msg.target) break;
					}
				}
			}
		});

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

		console.log("[generateCustomAnim] Fragments (alt/loop/opt):", fragments);

		return [lifelines, messages, fragments];
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

		return cells.filter(cell => {
			// Always include the layer itself
			if (cell.getAttribute("id") === layerId) {
				return true;
			}

			// Only process descendants
			if (!descendantIds.has(cell.getAttribute("id"))) {
				return false;
			}

			// Check visibility: if 'visible' attribute is "0", it's hidden. Otherwise, it's visible.
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
	function buildAnimationScript(lifelines, messages, cdRelations, cdCells) {
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
		function addInterDiagramLink(sourceId, targetId) {
			animationScript += `add ${sourceId} ${targetId}\n`;
		}
		function removeInterDiagramLink(sourceId, targetId) {
			animationScript += `remove ${sourceId} ${targetId}\n`;
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
			if (!highlighted.has(msg.id)) { 								// highlight sipky v SqD
				highlightArrow(msg.id);
			}
			if (sourceParent.matchedClassId && !highlighted.has(sourceParent.matchedClassId)) { // highlight source triedy v CD
				highlightCell(sourceParent.matchedClassId);
			}
			if (msg.matchedClassId && !highlighted.has(msg.matchedClassId)) { // highlight metody v CD
				highlightCell(msg.matchedClassId);
			}
			if (msg.matchedClassId && msg.id) {								// zlta sipka medzi metodou v CD a sipkou v SqD
				addInterDiagramLink(msg.matchedClassId, msg.id);
			}
			const relation = findRelationBetweenClasses(sourceParent.matchedClassId, targetParent.matchedClassId);
			if (relation && !highlighted.has(relation.id)) { 				// highlight sipky medzi triedami v CD
				highlightArrow(relation.id);
			}
			wait();
			if (targetParent.id && !highlighted.has(targetParent.id)) {		// highlight lifeline bloku v SqD
				highlightCell(targetParent.id);
			}
			if (msg.target && !highlighted.has(msg.target)) {				// highlight lifeline bloku v SqD
				highlightCell(msg.target);
			}
			if (targetParent.matchedClassId && !highlighted.has(targetParent.matchedClassId)) { // highlight target triedy v CD
				highlightCell(targetParent.matchedClassId);
			}
			if (targetParent.matchedClassId && targetParent.id) { 			// zlta sipka medzi triedou v CD a lifeline blokom v SqD
				addInterDiagramLink(targetParent.matchedClassId, targetParent.id);
			}
			wait();
		}

		// Animate a return step
		function animateReturnStep(msg, sourceParent, targetParent) {
			const matchingCall = findMatchingCall(msg);
			if (!highlighted.has(msg.id)) { 								// highlight return sipky v SqD
				highlightArrow(msg.id);
			}
			wait();
			if (matchingCall.matchedClassId && highlighted.has(matchingCall.matchedClassId)) { // UNhighlight metody v CD
				unhighlight(matchingCall.matchedClassId);
			}
			if (matchingCall.id && highlighted.has(matchingCall.id)) { 		// UNhighlight sipky ktora predstavuje volanie metody v SqD 
				unhighlight(matchingCall.id);
			}
			if (matchingCall.matchedClassId && matchingCall.id) { 			// zmaze zltu sipku medzi metodou v CD a sipkou v SqD
				removeInterDiagramLink(matchingCall.matchedClassId, matchingCall.id);
			}
			if (sourceParent.id && highlighted.has(sourceParent.id)) { 		// UNhighlight lifeline bloku v SqD
				unhighlight(sourceParent.id);
			}
			if (msg.source && highlighted.has(msg.source)) { 				// UNhighlight lifeline bloku v SqD
				unhighlight(msg.source);
			}
			if (sourceParent.matchedClassId && isClassEmpty(sourceParent.matchedClassId)) { // UNhighlight triedy v CD ak nema ziadnu vysvietenu metodu
				unhighlight(sourceParent.matchedClassId);
				
				if (sourceParent.matchedClassId && sourceParent.id) { 		// zmaze zltu sipku medzi triedou v CD a lifeline blokom v SqD
					removeInterDiagramLink(sourceParent.matchedClassId, sourceParent.id);
				}
			}
			if (highlighted.has(msg.id)) { 									// UNhighlight return sipky v SqD
				unhighlight(msg.id);
			}
			const relation = findRelationBetweenClasses(targetParent.matchedClassId, sourceParent.matchedClassId);
			if (relation && highlighted.has(relation.id)) {
				unhighlight(relation.id);									// UNhighlight sipky medzi triedami v CD
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
					return false;
				}
			}
			return true;
		}

		function findRelationBetweenClasses(sourceId, targetId) {
			console.log("find arrow between classes s: ", sourceId, "t: ", targetId);
			if (!sourceId || !targetId) {
				return;
			}

			console.log(cdRelations);
			return cdRelations.find(r => r.source === sourceId && r.target === targetId);

			// TODO 
		}
	}

	editorUi.actions.addAction('generateCustomAnim', function() {
		var animation = generateAnimation();

        // Save as a text file (one label per line)
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
