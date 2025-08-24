/**
 * okno na custom animaciu, zafarbuje na modro, upload suboru animacie v txt...
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('customAnimation=Custom Animation...');

	// Adds action
	editorUi.actions.addAction('customAnimation', function()
	{
		if (this.customAnimationWindow == null)
		{
			// LATER: Check outline window for initial placement
			this.customAnimationWindow = new CustomAnimationWindow(editorUi, (document.body.offsetWidth - 480) / 2,
				120, 640, 480);
			this.customAnimationWindow.window.setVisible(true);
		}
		else
		{
			this.customAnimationWindow.window.setVisible(!this.customAnimationWindow.window.isVisible());
		}
	});
	
	var menu = editorUi.menus.get('extras');
	var oldFunct = menu.funct;
	
	menu.funct = function(menu, parent)
	{
		oldFunct.apply(this, arguments);
		
		editorUi.menus.addMenuItems(menu, ['-', 'customAnimation'], parent);
	};

	function animateCells(graph, cells, steps, delay)
	{
		graph.executeAnimations(graph.createWipeAnimations(cells, true), null, steps, delay);
	};
	
	function mapCell(cell, clone, mapping)
	{
		mapping = (mapping != null) ? mapping : new Object();
		mapping[cell.id] = clone;
		
		var childCount = cell.getChildCount();
		
		for (var i = 0; i < childCount; i++)
		{
			mapCell(cell.getChildAt(i), clone.getChildAt(i), mapping);
		}
		
		return mapping;
	};
	
	var allowedToRun = false;
	var running = false;
	
	function stop()
	{
		allowedToRun = false;
	};
	
	function run(graph, steps, loop)
	{
		if (!running)
		{
			allowedToRun = true;
			running = true;
	
			// Store original styles for all cells
			var originalStyles = {};
			for (var id in graph.getModel().cells)
			{
				var cell = graph.getModel().cells[id];
				if (graph.getModel().isVertex(cell) || graph.getModel().isEdge(cell))
				{
					originalStyles[id] = {
						fillColor: graph.getCellStyle(cell)['fillColor'],
						strokeColor: graph.getCellStyle(cell)['strokeColor'],
						strokeWidth: graph.getCellStyle(cell)['strokeWidth']
					};
				}
			}
	
			graph.getModel().beginUpdate();
			try
			{
				for (var id in graph.getModel().cells)
				{
					var cell = graph.getModel().cells[id];
					
					if (graph.getModel().isVertex(cell) || graph.getModel().isEdge(cell))
					{
						graph.setCellStyles('opacity', '100', [cell]);
						graph.setCellStyles('noLabel', null, [cell]);
					}
				}
			}
			finally
			{
				graph.getModel().endUpdate();
			}
			
			function hexToRgb(hex) {
				hex = hex.replace(/^#/, '');
				if (hex.length === 8) hex = hex.slice(0, 6);
				if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
				const num = parseInt(hex, 16);
				return [num >> 16 & 255, num >> 8 & 255, num & 255];
			}

			function rgbToHex(rgb) {
				return '#' + rgb.map(x => {
					const h = x.toString(16);
					return h.length === 1 ? '0' + h : h;
				}).join('');
			}

			function lerp(a, b, t) {
				return a + (b - a) * t;
			}

			function lerpColor(a, b, t) {
				return [
					Math.round(lerp(a[0], b[0], t)),
					Math.round(lerp(a[1], b[1], t)),
					Math.round(lerp(a[2], b[2], t))
				];
			}

			function animateCellTransition(cell, graph, fromStyle, toStyle, fontStyle = '0', duration = 300) {
				const fillA = hexToRgb(fromStyle.fillColor || '#ffffff');
				const fillB = hexToRgb(toStyle.fillColor || '#ffffff');
				const strokeA = hexToRgb(fromStyle.strokeColor || '#000000');
				const strokeB = hexToRgb(toStyle.strokeColor || '#000000');
				const widthA = parseFloat(fromStyle.strokeWidth || 1);
				const widthB = parseFloat(toStyle.strokeWidth || 1);

				let start = null;

				function animateFrame(ts) {
					if (!start) start = ts;
					const t = Math.min(1, (ts - start) / duration);

					const fill = rgbToHex(lerpColor(fillA, fillB, t));
					const stroke = rgbToHex(lerpColor(strokeA, strokeB, t));
					const width = lerp(widthA, widthB, t).toString();

					graph.setCellStyles('fillColor', fill, [cell]);
					graph.setCellStyles('strokeColor', stroke, [cell]);
					graph.setCellStyles('strokeWidth', width, [cell]);
					graph.setCellStyles('fontStyle', fontStyle, [cell]);

					if (t < 1) {
						requestAnimationFrame(animateFrame);
					} else {
						// Ensure final values
						graph.setCellStyles('fillColor', toStyle.fillColor || null, [cell]);
						graph.setCellStyles('strokeColor', toStyle.strokeColor || null, [cell]);
						graph.setCellStyles('strokeWidth', toStyle.strokeWidth?.toString() || null, [cell]);
						graph.setCellStyles('fontStyle', fontStyle, [cell]);
					}
				}

				requestAnimationFrame(animateFrame);
			}

			var mapping = mapCell(editorUi.editor.graph.getModel().getRoot(), graph.getModel().getRoot());
			var step = 0;
			
			function next()
			{
				if (allowedToRun && step < steps.length)
				{
					var tokens = steps[step].split(' ');
					
					if (tokens.length > 0)
					{
						if (tokens[0] == 'wait' && tokens.length > 1)
						{
							window.setTimeout(function()
							{
								step++;
								next();
							}, parseFloat(tokens[1]));
						}
						else
						{
							if (tokens.length > 1)
							{
								// Handle 'add id1 id2' command to add a yellow arrow between diagrams
								if (tokens[0] === 'add' && tokens.length > 2) {
									var source = mapping[tokens[1]];
									var target = mapping[tokens[2]];
									if (source && target) {
										graph.getModel().beginUpdate();
										// console.log("[customAnimation] Adding link between: ", source, target);
										try {
											var parent = graph.getDefaultParent();
											var edge = graph.insertEdge(
												parent,
												null,
												'',
												source,
												target,
												// 'strokeColor=#ffeb3b;strokeWidth=3;endArrow=block;endFill=1;endSize=13;edgeStyle=orthogonalEdgeStyle;elbow=vertical;sourcePerimeter=1;entryX=0.5;entryY=0;entryPerimeter=1;'
												'strokeColor=#ffeb3b;strokeWidth=3;endArrow=block;endFill=1;endSize=13;sourcePerimeter=1;entryX=0.5;entryY=0;entryPerimeter=1;'
											);
										} catch (e) {
											console.error('[customAnimation] Error inserting edge:', e);
										} finally {
											graph.getModel().endUpdate();
										}
									} else {
										console.warn('[customAnimation] Could not find source or target cell for add command:', tokens[1], tokens[2]);
									}
									step++;
									next();
									return;
								}
								// Handle 'remove id1 id2' command to remove a yellow arrow between diagrams
								else if (tokens[0] === 'remove' && tokens.length > 2) {
									// console.log('[customAnimation] REMOVE command detected:', tokens);
									var source = mapping[tokens[1]];
									var target = mapping[tokens[2]];
									if (source && target) {
										var edgesToRemove = [];
										// Iterate all cells to find matching yellow edges
										for (var id in graph.getModel().cells) {
											var cell = graph.getModel().cells[id];
											if (
												graph.getModel().isEdge(cell) &&
												graph.getModel().getTerminal(cell, true) === source &&
												graph.getModel().getTerminal(cell, false) === target
											) {
												var style = graph.getCellStyle(cell);
												if (style['strokeColor'] === '#ffeb3b') {
													edgesToRemove.push(cell);
												}
											}
										}
										if (edgesToRemove.length > 0) {
											graph.getModel().beginUpdate();
											try {
												graph.removeCells(edgesToRemove);
												// console.log('[customAnimation] Removed yellow edge(s):', edgesToRemove);
											} catch (e) {
												console.error('[customAnimation] Error removing edge(s):', e);
											} finally {
												graph.getModel().endUpdate();
											}
										} else {
											console.warn('[customAnimation] No yellow edge found between', tokens[1], tokens[2]);
										}
									} else {
										console.warn('[customAnimation] Could not find source or target cell for remove command:', tokens[1], tokens[2]);
									}
									step++;
									next();
									return;
								}

								var cell = mapping[tokens[1]];
								
								if (cell != null)
								{
									const style = graph.getCellStyle(cell);
									const orig = originalStyles[cell.id] || {};

									if (tokens[0] === 'animate') {
										const fromStyle = {
											fillColor: style['fillColor'] || '#ffffff',
											strokeColor: style['strokeColor'] || '#000000',
											strokeWidth: style['strokeWidth'] || 1
										};

										const toStyle = {
											fillColor: '#008cffff',
											strokeColor: '#005296ff',
											strokeWidth: 2
										};

										animateCellTransition(cell, graph, fromStyle, toStyle, '1'); // bold
									}
									else if (tokens[0] === 'hide') {
										const fromStyle = {
											fillColor: style['fillColor'] || '#ffffff',
											strokeColor: style['strokeColor'] || '#000000',
											strokeWidth: style['strokeWidth'] || 1
										};

										const toStyle = {
											fillColor: orig.fillColor || '#ffffff',
											strokeColor: orig.strokeColor || '#000000',
											strokeWidth: orig.strokeWidth || 1
										};

										animateCellTransition(cell, graph, fromStyle, toStyle, '0'); // normal
									}
									else if (tokens[0] == 'roll')
									{
										graph.setCellStyles('strokeColor', '#008cffff', [cell]);
										graph.setCellStyles('strokeWidth', '2', [cell]);
										animateCells(graph, [cell]);
									}
					                else if (tokens[0] == 'flow')
									{
						                if (graph.model.isEdge(cell))
						                {
						                  	toggleFlowAnim(graph, [cell], tokens[2]);
						                }
									}
								}
								else
								{
									console.warn('cell not found', id, steps[step]);
								}
							}
							
							step++;
							next();
						}
					}
				}
				else
				{
					running = false;
					
					if (loop)
					{
						// Workaround for edge animation
						graph.refresh();
						run(graph, steps, loop);
					}
				}
			};
		
			next();
		}
	};
	
	var CustomAnimationWindow = function(editorUi, x, y, w, h)
	{
		// Modern container
		var main = document.createElement('div');
		main.className = 'custom-anim-main';

		// Flex row for editor and preview
		var flexRow = document.createElement('div');
		flexRow.className = 'custom-anim-flexrow';

		// Editor column
		var editorCol = document.createElement('div');
		editorCol.className = 'custom-anim-editorcol';

		var list = document.createElement('textarea');
		list.className = 'custom-anim-textarea';
		list.placeholder = 'Enter animation commands here...';

		var root = editorUi.editor.graph.getModel().getRoot();
		if (root.value != null && typeof(root.value) == 'object')
		{
			list.value = root.value.getAttribute('customAnimation');
		}
		editorCol.appendChild(list);

		// Button group
		var btnGroup = document.createElement('div');
		btnGroup.className = 'custom-anim-btngroup';

	    var buttons = {
	      'Animate': 'animate CELL',
	      'Roll In': 'roll CELL',
	      'Hide': 'hide CELL',
	      'Flow On': 'flow CELL start',
	      'Flow Off': 'flow CELL stop',
	      'Flow Toggle': 'flow CELL',
	      'Wait': 'wait 1500', 
	    }
	    var bkeys = Object.keys(buttons);

	    for (var i = 0; i < bkeys.length; i++)
	    {
	      (function(key)
	      {
		      var btn = mxUtils.button(key, function()
		      {
		        var val = buttons[key];
		        
		        function insertAtCursor(textarea, text) {
		          var start = textarea.selectionStart;
		          var end = textarea.selectionEnd;
		          var before = textarea.value.substring(0, start);
		          var after = textarea.value.substring(end);
		          textarea.value = before + text + after;
		          textarea.selectionStart = textarea.selectionEnd = start + text.length;
		          textarea.focus();
		        }
		        
		        if (val.indexOf('CELL') > -1)
		        {
		          var cells = editorUi.editor.graph.getSelectionCells();
		          
		          if (cells.length > 0)
		          {
		            for (var i = 0; i < cells.length; i++)
		            {
		              var tmp = val.replace('CELL', cells[i].id)
		              insertAtCursor(list, tmp + '\n');
		            }
		          }
		        }
		        else
		        {
		          if (val)
		          {
		            insertAtCursor(list, val + '\n');
		          }
		        }
		      });
		      btn.className += ' custom-anim-btn';
		      btnGroup.appendChild(btn);
	      })(bkeys[i]);
	    }
		editorCol.appendChild(btnGroup);

		// Action buttons
		var actionGroup = document.createElement('div');
		actionGroup.className = 'custom-anim-actiongroup';

		var runBtn = mxUtils.button('Preview', function()
		{
			graph.getModel().clear();
			graph.getModel().setRoot(graph.cloneCells([editorUi.editor.graph.getModel().getRoot()])[0]);
			graph.maxFitScale = 1;
			graph.fit(8);
			graph.center();
			
			run(graph, list.value.split('\n'));
		});
		runBtn.className += ' custom-anim-actionbtn';
		actionGroup.appendChild(runBtn);

		var stopBtn = mxUtils.button('Stop', function()
		{
			graph.getModel().clear();
			stop();
		});
		stopBtn.className += ' custom-anim-actionbtn';
		actionGroup.appendChild(stopBtn);

		var applyBtn = mxUtils.button('Apply', function()
		{
			editorUi.editor.graph.setAttributeForCell(root, 'customAnimation', list.value);
		});
		applyBtn.className += ' custom-anim-actionbtn';
		actionGroup.appendChild(applyBtn);

		editorCol.appendChild(actionGroup);

		// Upload .txt animation
		var uploadDiv = document.createElement('div');
		uploadDiv.style.marginBottom = '0.5rem';
		var uploadInput = document.createElement('input');
		uploadInput.type = 'file';
		uploadInput.accept = '.txt';
		uploadInput.style.display = 'none';
		var uploadBtn = mxUtils.button('Upload', function() {
			uploadInput.click();
		});
		uploadBtn.className += ' custom-anim-actionbtn';
		uploadInput.addEventListener('change', function(e) {
			if (uploadInput.files && uploadInput.files[0]) {
				var file = uploadInput.files[0];
				var reader = new FileReader();
				reader.onload = function(evt) {
					var text = evt.target.result;
					// Replace the entire textarea content with the uploaded animation
					list.value = text.trim();
					// Move cursor to the end
					list.selectionStart = list.selectionEnd = list.value.length;
					list.focus();
				};
				reader.readAsText(file);
			} else {
				console.warn("No file selected or file input error.");
			}
		});
		actionGroup.appendChild(uploadBtn);
		actionGroup.appendChild(uploadInput);
		
		// Preview grapch container
		var container = document.createElement('div');
		container.className = 'custom-anim-preview';
		mxEvent.disableContextMenu(container);

		var graph = new Graph(container);
		graph.setEnabled(false);
		graph.setPanning(true);
		graph.foldingEnabled = false;
		graph.panningHandler.ignoreCell = true;
		graph.panningHandler.useLeftButtonForPanning = true;
		graph.minFitScale = null;
		graph.maxFitScale = null;
		graph.centerZoom = true;

		flexRow.appendChild(editorCol);
		flexRow.appendChild(container);
		main.appendChild(flexRow);

		// Modern styles
		var style = document.createElement('style');
		style.textContent = `
		.custom-anim-main {
			font-family: 'Segoe UI', Arial, sans-serif;
			background: #f8f9fa;
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
    		padding-top: 0.7rem;
		}
		.custom-anim-flexrow {
			display: flex;
			flex: 1 1 0;
			gap: 1.5rem;
			padding: 0 1.5rem 1.5rem 1.5rem;
			box-sizing: border-box;
			min-height: 0;
		}
		.custom-anim-editorcol {
			display: flex;
			flex-direction: column;
			flex: 0 0 400px;
			min-width: 200px;
			height: 100%;
			gap: 1rem;
		}
		.custom-anim-textarea {
			width: 100%;
			height: 220px;
			resize: vertical;
			padding: 0.75rem;
			font-size: 1rem;
			border: 1px solid #d0d7de;
			border-radius: 6px;
			background: #fff;
			box-sizing: border-box;
			margin-bottom: 0.5rem;
			transition: border 0.2s;
		}
		.custom-anim-textarea:focus {
			border: 1.5px solid #0078d4;
			outline: none;
		}
		.custom-anim-btngroup {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}
		.custom-anim-btn {
			background: #e9ecef;
			border: 1px solid #d0d7de;
			border-radius: 5px;
			padding: 0.4rem 0.9rem;
			font-size: 0.98rem;
			cursor: pointer;
			transition: background 0.2s, border 0.2s;
		}
		.custom-anim-btn:hover {
			background: #d0ebff;
			border: 1.5px solid #0078d4;
		}
		.custom-anim-actiongroup {
			display: flex;
			gap: 0.7rem;
			margin-top: 0.5rem;
		}
		div.custom-anim-main .custom-anim-actionbtn {
			background: #0078d4 !important;
			color: #fff !important;
			border: none;
			border-radius: 5px;
			padding: 0.5rem 1.2rem;
			font-size: 1rem;
			cursor: pointer;
			transition: background 0.2s;
		}
		div.custom-anim-main .custom-anim-actionbtn:hover {
			background: #005fa3 !important;
		}
		.custom-anim-preview {
			background: #fff;
			border: 1.5px solid #d0d7de;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0,0,0,0.04);
			min-height: 200px;
			min-width: 200px;
			height: 100%;
			width: 100%;
		}
		`;

		main.appendChild(style);

		this.window = new mxWindow('Custom Animation', main, x, y, w, h, true, true);
		this.window.destroyOnClose = false;
		this.window.setMaximizable(false);
		this.window.setResizable(true);
		this.window.setClosable(true);
		this.window.setVisible(true);
		this.window.setSize(1000, 480);
	};
	
	// Autostart in chromeless mode
	if (editorUi.editor.isChromelessView())
	{
		function startAnimation()
		{
			var root = editorUi.editor.graph.getModel().getRoot();
			var result = false;
			
			if (root.value != null && typeof(root.value) == 'object')
			{
				var desc = root.value.getAttribute('customAnimation');
				
				if (desc != null)
				{
					run(editorUi.editor.graph, desc.split('\n'), true);
					result = true;
				}
			}
			
			return result;
		};
		
		// Wait for file to be loaded if no animation data is present
		if (!startAnimation())
		{
			editorUi.editor.addListener('fileLoaded', startAnimation);
		}
	}

	// Add flow capability
	function toggleFlowAnim(graph, cells, status)
	{
	    if (!status)
	    {
	      status = 'toggle'
	    }
	    
		for (var i = 0; i < cells.length; i++)
		{
			if (editorUi.editor.graph.model.isEdge(cells[i]))
			{
				var state = graph.view.getState(cells[i]);
				
				if (state && state.shape != null)
				{
					var paths = state.shape.node.getElementsByTagName('path');
					
					if (paths.length > 1)
					{
						if ((status == 'toggle' && paths[1].getAttribute('class') == 'mxEdgeFlow') || status == 'stop')
						{
							paths[1].removeAttribute('class');

							if (mxUtils.getValue(state.style, mxConstants.STYLE_DASHED, '0') != '1')
							{
								paths[1].removeAttribute('stroke-dasharray');
							}
						}
						else if ((status == 'toggle' && paths[1].getAttribute('class') != 'mxEdgeFlow') || status == 'start')
						{
							paths[1].setAttribute('class', 'mxEdgeFlow');
			
							if (mxUtils.getValue(state.style, mxConstants.STYLE_DASHED, '0') != '1')
							{
								paths[1].setAttribute('stroke-dasharray', '8');
							}
						}
					}
				}
			}
		}
	};

});
