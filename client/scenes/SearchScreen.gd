extends Control

const SEARCH_SECONDS := 180
const MATCH_REVEAL_AFTER := 3.0
const WAVE_SIZE := 260.0
const WAVE_COUNT := 3
const WAVE_SPACING := 40.0

@onready var timer_label: Label = %TimerLabel
@onready var wave_container: Control = %WaveContainer
@onready var opponent_card: PanelContainer = %OpponentCard

var _search_time_left := float(SEARCH_SECONDS)
var _match_reveal_timer := 0.0
var _waves: Array[Panel] = []

func _ready() -> void:
	call_deferred("_build_waves")
	_update_timer_label()

func _process(delta: float) -> void:
	_search_time_left = maxf(_search_time_left - delta, 0.0)
	_match_reveal_timer += delta
	_animate_waves(delta)
	_update_timer_label()
	if _match_reveal_timer >= MATCH_REVEAL_AFTER:
		opponent_card.visible = true

func _build_waves() -> void:
	for index in WAVE_COUNT:
		var wave := Panel.new()
		wave.name = "Wave%d" % (index + 1)
		var size := WAVE_SIZE + index * WAVE_SPACING
		wave.custom_minimum_size = Vector2(size, size)
		wave.position = Vector2((wave_container.size.x - size) * 0.5, (wave_container.size.y - size) * 0.5)

		var style := StyleBoxFlat.new()
		style.bg_color = Color(0, 0, 0, 0)
		style.border_width_left = 2
		style.border_width_right = 2
		style.border_width_top = 2
		style.border_width_bottom = 2
		style.border_color = Color(0.35, 0.72, 1, 0.6 - index * 0.1)
		style.corner_radius_top_left = int(size * 0.5)
		style.corner_radius_top_right = int(size * 0.5)
		style.corner_radius_bottom_left = int(size * 0.5)
		style.corner_radius_bottom_right = int(size * 0.5)
		wave.add_theme_stylebox_override("panel", style)

		wave_container.add_child(wave)
		_waves.append(wave)

func _animate_waves(delta: float) -> void:
	var time := float(Time.get_ticks_msec()) / 1000.0
	for index in _waves.size():
		var wave := _waves[index]
		var pulse := sin(time * 2.0 - index * 0.6) * 0.08 + 1.0
		wave.scale = Vector2(pulse, pulse)
		wave.modulate.a = 0.35 + 0.2 * sin(time * 2.0 - index * 0.4)

func _update_timer_label() -> void:
	var total_seconds := int(round(_search_time_left))
	var minutes := total_seconds / 60
	var seconds := total_seconds % 60
	timer_label.text = "Осталось: %02d:%02d" % [minutes, seconds]
