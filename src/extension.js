'use strict';

const Main = imports.ui.main;
const LM = Main.layoutManager;
const Layout = imports.ui.layout;
const Display = global.display;
const St = imports.St;
const Meta = imports.Meta;

const ExtensionUtils = imports.misc.extensionUtils;

let monitor_manager;
let _settings = null;
let _on_fullscreen;
let _on_monitors;
let _current_monitor = null;
let _panel_box = null;

/*
function overlap_horiz(m1, m2) {
    return m1.x < m2.x + m2.width && m2.x < m1.x + m1.width;
}

function overlap_vert(m1, m2) {
    return m1.y < m2.y + m2.height && m2.y < m1.y + m1.height;
}
*/

function update_controls() {
    let show = true;
	if (!_settings.get_boolean('manual-controls')) {
        show = false;
    } else if (LM.monitors.length == 1) {
        show = false;
    } else if (!_current_monitor) {
        _current_monitor = get_current_monitor();
        if (!_current_monitor) {
            show = false;
        }
    }
    let dirs = {
        left: false,
        right: false,
        up: false,
        down: false
    };
    if (show) {
        for (const monitor of LM.monitors) {
            if (monitor.x < _current_monitor.x) {
                dirs.left = true;
            } else if (monitor.x > _current_monitor.x) {
                dirs.right = true;
            }
            if (monitor.y < _current_monitor.y) {
                dirs.up = true;
            } else if (monitor.y > _current_monitor.y) {
                dirs.down = true;
            }
        }
        if (!(dirs.left || dirs.right || dirs.up || dirs.down)) {
            show = false;
        }
    }
    if (_panel_box) {
        _panel_box.remove_all_children();
    }
    if (!show) {
        if (_panel_box) {
            _panel_box.destroy();
            _panel_box = null;
        }
        return;
    }
    if (!_panel_box) {
        _panel_box = new St.BoxLayout();
        main.panel._rightBox.insert_child_at_index(button, 0);
    }
    for (const d in dirs) {
        let icon = new St.Icon({
            style_class: "system-status-icon",
            icon_name: `go-${d}-symbolic`
        });
        let button = new St.Bin({
            style_class: "panel-button",
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        button.set_child(icon);
        /*
        button.connect("button-press-event", function() {
            if (fixed) {
                disable_fix();
            } else {
                enable_fix();
            }
        });
        */
        _panel_box.add_child(button);
    }
}

function get_current_monitor() {
	for (const monitor of LM.monitors) {
		if (monitor.x == LM.panelBox.x && monitor.y == LM.panelBox.y) {
			return monitor;
		}
	}
}

function get_unfullscreen_monitor() {
	for (const monitor of LM.monitors) {
		if (!monitor.inFullscreen) {
			return monitor;
		}
	}
}

function fullscreen_changed() {
	if (LM.monitors.length < 2) {
		return;
	}

    let avoid_fullscreen = _settings.get_boolean('avoid-fullscreen');

	let primary_monitor = LM.primaryMonitor;
	let unfullscreen_monitor = get_unfullscreen_monitor();
	if (!unfullscreen_monitor) {
        if (avoid_fullscreen) {
            return;
        } else {
            avoid_fullscreen = false;
        }
	}

    if (!_current_monitor) {
        _current_monitor = get_current_monitor();
    }
	if ((_current_monitor?.inFullscreen ?? true) && avoid_fullscreen) {
		move_panel(unfullscreen_monitor);
	} else {
		move_panel(primary_monitor);
	}
}

function move_panel(monitor) {
    if (_current_monitor === monitor) {
        return;
    }
    _current_monitor = monitor;
	LM.panelBox.x = monitor.x;
	LM.panelBox.y = monitor.y;
	LM.panelBox.width = monitor.width;
	LM.panelBox.visible = true;
    move_hotcorners(monitor);
    update_controls();
}

function move_hotcorners(monitor) {
	if (!_settings.get_boolean('move-hot-corners')) {
		return;
	}

	LM.hotCorners.forEach((corner) => {
		if (corner)
			corner.destroy();
	});
	LM.hotCorners = [];

	if (!LM._interfaceSettings.get_boolean('enable-hot-corners')) {
		LM.emit('hot-corners-changed');
		return;
	}

	let size = LM.panelBox.height;

	let corner = new Layout.HotCorner(LM, monitor, monitor.x, monitor.y);
	corner.setBarrierSize(size);
	LM.hotCorners.push(corner);

	LM.emit('hot-corners-changed');
}

function enable() {
	_settings = ExtensionUtils.getSettings();
	_on_fullscreen = Display.connect('in-fullscreen-changed', fullscreen_changed);
    update_controls();
    _settings.connect("changed", function(settings, key) {
        if (key == "avoid-fullscreen") {
            fullscreen_changed();
        } else if (key == "manual-controls") {
            update_controls();
        }
    });
    monitor_manager = Meta.MonitorManager.get();
    _on_monitors = monitor_manager.connect("monitors-changed", update_controls);
}

function disable() {
	monitor_manager.disconnect(_on_monitors);
	Display.disconnect(_on_fullscreen);
	_settings.run_dispose();
}

function init() {
	ExtensionUtils.initTranslations();
}
