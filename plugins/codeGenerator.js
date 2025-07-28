/**
 * TODO predpriprava na generovanie kodu, zatial to len berie text z vrcholov diagramu a ulozi do txt
 */
Draw.loadPlugin(function(editorUi)
{
	// Adds resource for action
	mxResources.parse('extractNodeTexts=Generate code...');

	// Adds action for extracting node texts
	editorUi.actions.addAction('extractNodeTexts', function()
	{
		var graph = editorUi.editor.graph;
		var model = graph.getModel();
		var cells = model.cells;
		var nodeTexts = [];

		for (var id in cells)
		{
			var cell = cells[id];
			if (model.isVertex(cell))
			{
				// Prefer graph.getLabel(cell) for user-visible text
				var label = graph.getLabel(cell);
				nodeTexts.push(label);
			}
		}

		// Save as a text file (one label per line)
		var blob = new Blob([nodeTexts.join('\n')], {type: 'text/plain'});
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'extracted_text.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	});

	var menu = editorUi.menus.get('extras');
	var oldFunct = menu.funct;

	menu.funct = function(menu, parent)
	{
		oldFunct.apply(this, arguments);

		editorUi.menus.addMenuItems(menu, ['-', '', 'extractNodeTexts'], parent);
	};

});