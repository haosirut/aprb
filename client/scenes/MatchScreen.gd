extends Control

const GRID_COLUMNS := 5
const GRID_ROWS := 10
const CELL_SIZE := Vector2(96, 96)
const ROUND_SECONDS := 180
const PHASE_SECONDS := 30

const PHASES := ["Действия", "ЮнитР", "Завершение хода"]

const STATE_NORMAL := "normal"
const STATE_FOG := "fog"
const STATE_SCOUT := "scout"
const STATE_BLOCKED := "blocked"
const STATE_DESTROYED := "destroyed"

const HIGHLIGHT_NONE := "none"
const HIGHLIGHT_MOVE := "move"
const HIGHLIGHT_ATTACK := "attack"

@onready var phase_label: Label = %PhaseLabel
@onready var phase_button: Button = %PhaseArrowButton
@onready var round_timer_label: Label = %RoundTimerLabel
@onready var phase_timer_label: Label = %PhaseTimerLabel
@onready var board_area: Control = %BoardArea
@onready var unit_row: HBoxContainer = %UnitRow
@onready var move_button: Button = %MoveButton
@onready var attack_button: Button = %AttackButton
@onready var scout_button: Button = %ScoutButton

var _current_phase_index := 0
var _round_time_left := float(ROUND_SECONDS)
var _phase_time_left := float(PHASE_SECONDS)

var _selected_unit_index := -1
var _unit_assignments: Array[String] = []
var _unit_buttons: Array[Button] = []
var _unit_labels: Array[Label] = []

func _ready() -> void:
	phase_button.pressed.connect(_advance_phase)
	move_button.pressed.connect(func() -> void: _assign_action("Перемещение"))
	attack_button.pressed.connect(func() -> void: _assign_action("Атака"))
	scout_button.pressed.connect(func() -> void: _assign_action("Разведка"))
	_build_board()
	_build_unit_panel()
	_update_phase_ui()

func _process(delta: float) -> void:
	_round_time_left = maxf(_round_time_left - delta, 0.0)
	_phase_time_left = maxf(_phase_time_left - delta, 0.0)
	_update_timer_labels()

func _advance_phase() -> void:
	_current_phase_index = (_current_phase_index + 1) % PHASES.size()
	_phase_time_left = float(PHASE_SECONDS)
	_update_phase_ui()

func _update_phase_ui() -> void:
	phase_label.text = "Фаза: %s" % PHASES[_current_phase_index]

func _update_timer_labels() -> void:
	round_timer_label.text = "Раунд: %s" % _format_time(_round_time_left)
	phase_timer_label.text = "Лимит фазы: %s" % _format_time(_phase_time_left)

func _format_time(time_left: float) -> String:
	var total_seconds := int(round(time_left))
	var minutes := total_seconds / 60
	var seconds := total_seconds % 60
	return "%02d:%02d" % [minutes, seconds]

func _build_board() -> void:
	board_area.custom_minimum_size = Vector2(
		CELL_SIZE.x * GRID_COLUMNS,
		CELL_SIZE.y * GRID_ROWS
	)

	var top_sector := ColorRect.new()
	top_sector.name = "TopSector"
	top_sector.color = Color("#1b2233")
	top_sector.size = Vector2(CELL_SIZE.x * GRID_COLUMNS, CELL_SIZE.y * 5)
	board_area.add_child(top_sector)

	var bottom_sector := ColorRect.new()
	bottom_sector.name = "BottomSector"
	bottom_sector.color = Color("#1f2a1d")
	bottom_sector.position = Vector2(0, CELL_SIZE.y * 5)
	bottom_sector.size = Vector2(CELL_SIZE.x * GRID_COLUMNS, CELL_SIZE.y * 5)
	board_area.add_child(bottom_sector)

	var divider := ColorRect.new()
	divider.name = "SectorDivider"
	divider.color = Color("#9aa7bf")
	divider.position = Vector2(0, CELL_SIZE.y * 5 - 2)
	divider.size = Vector2(CELL_SIZE.x * GRID_COLUMNS, 4)
	board_area.add_child(divider)

	var grid := GridContainer.new()
	grid.name = "CellGrid"
	grid.columns = GRID_COLUMNS
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grid.position = Vector2.ZERO
	grid.custom_minimum_size = Vector2(CELL_SIZE.x * GRID_COLUMNS, CELL_SIZE.y * GRID_ROWS)
	board_area.add_child(grid)

	var sample_states := _sample_cell_states()
	for row in GRID_ROWS:
		for col in GRID_COLUMNS:
			var cell_index := row * GRID_COLUMNS + col
			var state := sample_states[cell_index]["state"]
			var highlight := sample_states[cell_index]["highlight"]
			var cell := _make_cell(state, highlight)
			grid.add_child(cell)

func _make_cell(state: String, highlight: String) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = CELL_SIZE
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL

	var style := StyleBoxFlat.new()
	style.bg_color = _state_color(state)
	style.border_width_left = 3
	style.border_width_right = 3
	style.border_width_top = 3
	style.border_width_bottom = 3
	style.border_color = _highlight_color(highlight)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	panel.add_theme_stylebox_override("panel", style)

	var label := Label.new()
	label.text = _state_label(state)
	label.horizontal_alignment = HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VerticalAlignment.VERTICAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_child(label)

	return panel

func _state_color(state: String) -> Color:
	match state:
		STATE_FOG:
			return Color("#0f131c")
		STATE_SCOUT:
			return Color("#24314d")
		STATE_BLOCKED:
			return Color("#3a3f47")
		STATE_DESTROYED:
			return Color("#5b2f2f")
		_:
			return Color("#2c2f3a")

func _highlight_color(highlight: String) -> Color:
	match highlight:
		HIGHLIGHT_MOVE:
			return Color("#45d483")
		HIGHLIGHT_ATTACK:
			return Color("#ff6b6b")
		_:
			return Color("#2c2f3a")

func _state_label(state: String) -> String:
	match state:
		STATE_FOG:
			return "Туман"
		STATE_SCOUT:
			return "Разведка"
		STATE_BLOCKED:
			return "Блок"
		STATE_DESTROYED:
			return "Разрушена"
		_:
			return ""

func _sample_cell_states() -> Array:
	var states: Array = []
	for index in GRID_ROWS * GRID_COLUMNS:
		states.append({"state": STATE_NORMAL, "highlight": HIGHLIGHT_NONE})

	states[1] = {"state": STATE_FOG, "highlight": HIGHLIGHT_NONE}
	states[3] = {"state": STATE_SCOUT, "highlight": HIGHLIGHT_MOVE}
	states[7] = {"state": STATE_BLOCKED, "highlight": HIGHLIGHT_NONE}
	states[11] = {"state": STATE_DESTROYED, "highlight": HIGHLIGHT_NONE}
	states[18] = {"state": STATE_NORMAL, "highlight": HIGHLIGHT_ATTACK}
	states[22] = {"state": STATE_NORMAL, "highlight": HIGHLIGHT_MOVE}
	states[27] = {"state": STATE_FOG, "highlight": HIGHLIGHT_ATTACK}
	states[33] = {"state": STATE_SCOUT, "highlight": HIGHLIGHT_NONE}
	states[41] = {"state": STATE_BLOCKED, "highlight": HIGHLIGHT_MOVE}
	states[48] = {"state": STATE_DESTROYED, "highlight": HIGHLIGHT_ATTACK}

	return states

func _build_unit_panel() -> void:
	_unit_assignments = []
	_unit_buttons = []
	_unit_labels = []

	for index in 5:
		var unit_box := VBoxContainer.new()
		unit_box.custom_minimum_size = Vector2(120, 72)

		var button := Button.new()
		button.text = "Юнит %d" % (index + 1)
		button.pressed.connect(func() -> void: _select_unit(index))
		unit_box.add_child(button)

		var label := Label.new()
		label.text = "Действие: —"
		label.horizontal_alignment = HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER
		unit_box.add_child(label)

		unit_row.add_child(unit_box)
		_unit_buttons.append(button)
		_unit_labels.append(label)
		_unit_assignments.append("")

func _select_unit(index: int) -> void:
	if _unit_assignments[index] != "":
		return
	_selected_unit_index = index
	for idx in _unit_buttons.size():
		_unit_buttons[idx].button_pressed = idx == _selected_unit_index

func _assign_action(action_name: String) -> void:
	if _selected_unit_index == -1:
		return
	if _unit_assignments[_selected_unit_index] != "":
		return

	_unit_assignments[_selected_unit_index] = action_name
	_unit_labels[_selected_unit_index].text = "Действие: %s" % action_name
	_unit_buttons[_selected_unit_index].disabled = true
	_selected_unit_index = -1
	for idx in _unit_buttons.size():
		_unit_buttons[idx].button_pressed = false
