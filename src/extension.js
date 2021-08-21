'use strict';

const Main = imports.ui.main;
const LM = Main.layoutManager;
const Layout = imports.ui.layout;
const Display = global.display;
const St = imports.gi.St;
const Meta = imports.gi.Meta;

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

// pos and size are "x","width" or "y","height". This compares both extremities
// of m1 against both extremities of m2 and returns the minimum of the 4
// distances.
function min_distance(m1, m2, pos, size) {
    let a0 = m1[pos];
    let a1 = m1[pos] + m1[size];
    let b0 = m2[pos];
    let b1 = m2[pos] + m2[size];
    return Math.min(Math.abs(a0 - b0), Math.abs(a0 - b1),
        Math.abs(a1 - b0), Math.abs(a1 - b1));
}

function manual_move(d) {
    let others = Array.from(LM.monitors).filter(m =>
            m.index != _current_monitor?.index);
    // Only one other monitor, easy
    if (others.length == 1) {
        move_panel(others[0]);
        return;
    }
    // Filter out monitors that aren't in the target direction
    let cm = _current_monitor;
    let cx = cm.x;
    let cy = cm.y;
    others = others.filter(m => {
        switch (d) {
            case "previous":
                return m.x < cx;
            case "next":
                return m.x > cx;
            case "up":
                return m.y < cy;
            case "down":
                return m.y > cy;
        }
    });
    if (others.length == 1) {
        move_panel(others[0]);
        return;
    }
    others.sort((m1, m2) => {
        // Prefer monitors that don't have a fullscreen window
        if (m1.inFullscreen && !m2.inFullscreen) {
            return 1;
        } else if (!m1.inFullscreen && m2.inFullscreen) {
            return -1;
        }
        // Then sort by distance from current monitor in primary direction
        let d1, d2;
        switch (d) {
            case "previous":
            case "next":
                d1 = min_distance(m1, cm, "x", "width");
                d2 = min_distance(m2, cm, "x", "width");
                break;
            case "up":
            case "down":
                d1 = min_distance(m1, cm, "y", "height");
                d2 = min_distance(m2, cm, "y", "height");
                break;
        }
        let d = d2 - d1;
        if (d) {
            return d;
        }
        // Finally sort by distance from current monitor orthogonal to primary
        switch (d) {
            case "previous":
            case "next":
                d1 = min_distance(m1, cm, "y", "height");
                d2 = min_distance(m2, cm, "y", "height");
                break;
            case "up":
            case "down":
                d1 = min_distance(m1, cm, "x", "width");
                d2 = min_distance(m2, cm, "x", "width");
                break;
        }
        return d2 - d1;
    });
    move_panel(others[0]);
}

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
        previous: false,
        next: false,
        up: false,
        down: false
    };
    if (show) {
        for (const monitor of LM.monitors) {
            if (monitor.x < _current_monitor.x) {
                dirs.previous = true;
            } else if (monitor.x > _current_monitor.x) {
                dirs.next = true;
            }
            if (monitor.y < _current_monitor.y) {
                dirs.up = true;
            } else if (monitor.y > _current_monitor.y) {
                dirs.down = true;
            }
        }
        if (!(dirs.previous || dirs.next || dirs.up || dirs.down)) {
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
        Main.panel._rightBox.insert_child_at_index(_panel_box, 0);
    }
    for (const d in dirs) {
        if (!dirs[d]) {
            continue;
        }
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
        button.connect("button-press-event", function() {
            manual_move(d);
        });
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
	} else if (avoid_fullscreen) {
		move_panel(primary_monitor);
	}
}

function move_panel(monitor) {
    if (_current_monitor.x === monitor.x && _current_monitor.y === monitor.y) {
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
