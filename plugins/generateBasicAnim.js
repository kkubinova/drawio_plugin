/**
 * vygeneruje vstup pre origo plugin animation.js - zatial verzia len pre sekvencny
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('generateBasicAnim=Generate Basic Animation...');

	// Function to extract XML from the current diagram
	function extractDiagramXml() {
		var xml = editorUi.getFileData();
		parseDiagramXml(xml);
	}

	function parseDiagramXml(xmlString) {
		var parser = new DOMParser();
		var xmlDoc = parser.parseFromString(xmlString, "text/xml");
		console.log(xmlString);

		// Find all mxCell elements
		var cells = Array.from(xmlDoc.getElementsByTagName("mxCell"));

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

		// Extract lifelines (umlLifeline in style)
		var lifelines = cells.filter(cell =>
			cell.getAttribute("style") && cell.getAttribute("style").includes("shape=umlLifeline")
		).map(cell => {
			// Find rectangle children for this lifeline
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

		// Extract messages/arrows (edge="1")
		var messages = cells.filter(cell =>
			cell.getAttribute("edge") === "1"
		).map(cell => ({
			id: cell.getAttribute("id"),
			label: cell.getAttribute("value"),
			parent: cell.getAttribute("parent"),
			source: cell.getAttribute("source"),
			target: cell.getAttribute("target"),
			dashed: cell.getAttribute("style").includes("dashed=1")
		}));

		// Extract sourcePoint and targetPoint for each message from mxGeometry or mxPoint
		messages.forEach(msg => {
			var cell = cells.find(c => c.getAttribute("id") === msg.id);
			if (!cell) return;

			var geometry = cell.getElementsByTagName("mxGeometry")[0];
			if (!geometry) return;

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


		// Helper: Check if point is inside a rectangle with optional padding
		function pointInRect(point, rect, padding = 20) {
			return point.x >= rect.x - padding &&
				point.x <= rect.x + rect.width + padding &&
				point.y >= rect.y - padding &&
				point.y <= rect.y + rect.height + padding;
		}

		// Assign source and target lifeline IDs based on sourcePoint and targetPoint
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
		
		console.log("calls", calls);
		console.log("returns", returns);

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
					source: msg.source,
					target: msg.target
				});
				visited.add(msg.id);
			}
		});

		// Output the results
		console.log("Lifelines:", lifelines);
		console.log("Messages/Arrows:", messages);
		console.log("Sequence Flow (ordered by connectivity):", flow);

		// Print the flow in readable order
		flow.forEach((msg, idx) => {
			console.log(
				`Step ${idx + 1}: [${msg.id}] "${msg.label}" from ${msg.source || "?"} to ${msg.target || "?"}`
			);
		});


		// Generate animation script for animation.js plugin with highlight tracking and waits
		let animationScript = "";
		const highlighted = new Set();

		
		function findLifelineByRectId(rectId) {
			return lifelines.find(lf => lf.rectangles.some(r => r.id === rectId)).id;
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
		function showCell(id) {
			animationScript += `show ${id} fade\n`;
			highlighted.add(id);
		}
		function showArrow(id) {
			animationScript += `show ${id}\n`;
			highlighted.add(id);
		}
		function hideElement(id) {
			animationScript += `hide ${id}\n`;
			highlighted.delete(id);
		}
		function wait(ms = 1500) {
			animationScript += `wait ${ms}\n`;
		}

		const initialLfParent = findLifelineByRectId(flow[0].source);
		const initialLf = flow[0].source;
		// Animate initial source lifeline block
		if (!highlighted.has(initialLfParent)) {
			showCell(initialLfParent);
		}
		if (!highlighted.has(initialLf)) {
			showCell(initialLf);
		}
		wait();

		flow.forEach((msg) => {
			const sourceParent = findLifelineByRectId(msg.source);
			const targetParent = findLifelineByRectId(msg.target);

			if (calls.some(call => call.id === msg.id)) {
				animateCallStep(msg, targetParent);
			} else if (returns.some(ret => ret.id === msg.id)) {
				animateReturnStep(msg, sourceParent);
			}
		});

		// Animate a call step
		function animateCallStep(msg, targetParent) {
			if (!highlighted.has(msg.id)) {
				showArrow(msg.id);
				wait();
			}
			if (!highlighted.has(targetParent)) {
				showCell(targetParent);
			}
			if (!highlighted.has(msg.target)) {
				showCell(msg.target);
			}
			wait();
		}

		// Animate a return step
		function animateReturnStep(msg, sourceParent) {
			const matchingCall = findMatchingCall(msg);
			console.log(matchingCall);

			if (!highlighted.has(msg.id)) {
				showArrow(msg.id);
				wait();
			}
			if (highlighted.has(sourceParent)) {
				hideElement(sourceParent);
			}
			if (highlighted.has(msg.source)) {
				hideElement(msg.source);
			}
			if (matchingCall && highlighted.has(matchingCall.id)) {
				hideElement(matchingCall.id);
			}
			if (highlighted.has(msg.id)) {
				hideElement(msg.id);
			}
			wait();
		}

	
		// Animate initial source lifeline block
		if (highlighted.has(initialLfParent)) {
			hideElement(initialLfParent);
		}
		if (highlighted.has(initialLf)) {
			hideElement(initialLf);
		}

		console.log("=== Animation Script ===\n" + animationScript);
		// Optionally, you could set this as an attribute or show in a dialog for user copy-paste
	}

	editorUi.actions.addAction('generateBasicAnim', function() {
		extractDiagramXml();
	});

	var menu = editorUi.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu, parent){
		oldFunct.apply(this, arguments);
		editorUi.menus.addMenuItems(menu, ['-', '', 'generateBasicAnim'], parent);
	};
});
