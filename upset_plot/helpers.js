// Helper functions for upset plot

function remove_zero_tick(axis){
  // Get rid of the zero tick value on an axis for cleanliness
  axis.selectAll('.tick')
    .filter(d => d === 0)
    .remove();
}


// Function to filter data down to the minimum desired set size
function filter_set_size(data, marginal_data, min_set_size = 100, remove_singletons = false){
  // Filter the main dataset down
  const filtered_data = data
    .filter(d => {
      const larger_than_min_size = d.count >= min_set_size;
      const has_multiple_codes = d.size !== 1;

      if(remove_singletons){
        return larger_than_min_size && has_multiple_codes;
      }

      return larger_than_min_size;
    })
    .sort((a,b) => b.count - a.count);

  // Get the remaining codes present after filtering
  const distinct_codes = unique(filtered_data.map(d => d.pattern).join('-').split('-'));

  // Filter the marginal data down to just the remaining codes
  const filtered_marginals = marginal_data
    .filter(d => distinct_codes.includes(d.code));

  return {
    patterns: filtered_data,
    marginals: filtered_marginals,
  };
}


function setup_set_size_x_scale(patterns, sizes){
  // Setup the x-scale for counts of the patterns
  return d3.scaleLinear()
    .range([sizes.set_size_bars_w, 0])
    .domain([0, d3.max(patterns, d=> d.count)]);
}


// Extract information about where on the screen each code in a pattern is
// Also returns the extent of those ranges for drawing the little bars
// that connect the patterns
function get_pattern_info(d, scales) {
  const positions_of_codes = d.pattern
    .split('-')
    .map(p => ({
      code: p,
      pos: scales.matrix_width_scale(p) + scales.matrix_width_scale.bandwidth()/2,
    }));

  const range_of_pattern = d3.extent(positions_of_codes, d => d.pos);

  return {
    positions: positions_of_codes,
    range: range_of_pattern,
  };
}


//-------------------------------------------------------
// Functions for drawing the four components of the chart
//-------------------------------------------------------

// Draw the dot matrix in the middle of plot that shows patterns
function draw_pattern_matrix(g, patterns, marginals, scales, sizes){
  g.html('');

  const matrix_rows = g.selectAll('.matrix_row')
    .data(patterns)
    .enter().append('g.matrix_row')
    .translate((d,i) => [0, scales.pattern_y(i) + scales.matrix_row_height/2] );

  // Light grey dots in the background to show possible codes
  matrix_rows.selectAll('.background_dots')
    .data(marginals.map(d => d.code))
    .enter().append('circle')
    .attr('class', 'allCodes')
    .at({
      cx: d => scales.matrix_width_scale(d) + scales.matrix_width_scale.bandwidth()/2,
      r: scales.matrix_dot_size,
      fill: colors.code_missing,
      fillOpacity: 0.5,
    });

  // Thin lines that span code range
  matrix_rows.selectAppend('line.pattern_extent')
    .at({
      x1: d => get_pattern_info(d, scales).range[0],
      x2: d => get_pattern_info(d, scales).range[1],
      stroke: colors.pattern_bar,
      strokeWidth: scales.matrix_dot_size/2
    });

  // Shaded present-codes dots
  matrix_rows.selectAll('.present_code_dots')
    .data(d => get_pattern_info(d, scales).positions)
    .enter().append('circle')
    .at({
      class: 'presentCodes',
      cx: d => d.pos,
      r: scales.matrix_dot_size,
      fill: d => scales.code_to_color[d.code],
    });


  //// Axis
  const matrix_axis = g.selectAppend("g.matrix_axis")
    .call(d3.axisBottom().scale(scales.matrix_width_scale))
    .translate([0, sizes.matrix_plot_h]);

  // Shift text for legibility
  matrix_axis
    .selectAll("text")
    .at({
      x: -7,
      y: -1,
      textAnchor: 'end',
      transform: 'rotate(-75)',
      fontSize:12
    });
  // remove horizontal bar
  matrix_axis.select('.domain').remove();


}

// Draw the left-side bar chart that shows the how many instances of a given pattern are in data
function draw_pattern_count_bars(g, patterns, scales, sizes){

  const pattern_count_bars = g.selectAll('rect')
    .data(patterns, d => d.pattern);

  const ending_attrs = {
    fill: colors.pattern_count_bars,
    x: d => scales.set_size_x(d.count),
    y: (d,i) => scales.pattern_y(i) + scales.matrix_row_height/2 - scales.set_size_bar_height/2,
    height: scales.set_size_bar_height,
    width: d => scales.set_size_x(0) - scales.set_size_x(d.count),
  };

  const starting_attrs = {
    x: sizes.set_size_bars_w,
    y: (d,i) => scales.pattern_y(i) + scales.matrix_row_height/2 - scales.set_size_bar_height/2,
    height: scales.set_size_bar_height,
    fill: 'green',
  };

  // Exit
  pattern_count_bars.exit().remove();

  // Append-Update
  pattern_count_bars.enter()
    .append('rect.pattern_count_bars')
    .at(starting_attrs)
    .merge(pattern_count_bars)
    .transition()
    .at(ending_attrs);


  //// Pattern count bars axis
  const axis = g.selectAppend("g.axis")
    .translate([0, sizes.matrix_plot_h])
    .call(d3.axisBottom()
            .scale(scales.set_size_x)
            .ticks(5)
            .tickSizeOuter(0) );

  axis.selectAll("text")
    .at({
      x: -2,
      y: +4,
      textAnchor: 'end',
    });

  // Get rid of the zero tick value for cleanliness
  //remove_zero_tick(axis);

   // Title subplot
  g.selectAppend('text.title')
    .at({
      textAnchor: 'middle',
      y: sizes.matrix_plot_h + sizes.margin.bottom - sizes.padding*2.5,
    })
    .html(`<tspan>Pattern frequency</tspan>
           <tspan font-size='13px' dy='15'>(drag handle to change threshold)</tspan>`)
    .selectAll('tspan')
      .attr('x', sizes.set_size_bars_w/2);
}

// Draw right hand size risk ratio estimate and confidence intervals for each pattern
function draw_rr_intervals(g, patterns, scales, sizes){

  const size_of_pe = Math.min(scales.matrix_row_height/2, 7);
  const size_of_interval_line = Math.max(1, size_of_pe/2);

  // Axis
  const axis = g.selectAppend("g.rr_intervals_axis")
    .translate([0,sizes.matrix_plot_h])
    .call(d3.axisBottom()
      .scale(scales.rr_x)
      .ticks(5)
      .tickSizeOuter(0));

  axis.selectAll("text")
    .at({
      x: 2,
      y: 4,
      textAnchor: 'start',
    });

  // Guide line at RR = 1 for reference of 'null'
  axis.selectAll('.tick line')
    .at({
      y1: d => d === 1 ? -sizes.matrix_plot_h: 0,
    });


  let rr_lines = g.selectAll('.rr_intervals')
    .data(patterns, d => d.pattern);

  rr_lines.exit().remove();

  // Now draw the intervals
  rr_lines =  rr_lines.enter()
    .append('g.rr_intervals')
    .merge(rr_lines)
    .transition()
    .translate((d,i) => [0, scales.pattern_y(i) + scales.matrix_row_height/2]);

  rr_lines.each(function(d){

    const is_null_interval = (d.upper === null) || (d.lower === null);

    const rr_g = d3.select(this);

    // Draw intervals

    // No need to draw interval if it's not defined.
    if(!is_null_interval){
      rr_g.selectAppend('line')
        .at({
          x1: scales.rr_x(d.lower),
          x2: scales.rr_x(d.upper),
          stroke: colors.rr_interval,
          strokeWidth: size_of_interval_line,
        });
    }

    const point_est_circle = rr_g.selectAppend('circle')
      .at({
        cx: scales.rr_x(d.pointEst),
        r: size_of_pe
      });

    if(is_null_interval){
      point_est_circle
        .at({
          fill: colors.null_rr_interval,
          fillOpacity: 0.1,
          stroke: colors.null_rr_interval,
          strokeWidth: 1.5,
          opacity: 0.5,
        });
    } else {
      point_est_circle
        .at({
          fill: colors.rr_interval
        });
    }

  });

  // Title subplot
  g.selectAppend('text.title')
    .text("Relative risk")
    .at({
      textAnchor: 'middle',
      y: sizes.matrix_plot_h + sizes.margin.bottom - sizes.padding*2.5,
      x: sizes.rr_plot_w/2,
    });
}

// Draw the top of the chart individual code marginal count bars
function draw_code_marginal_bars(g, marginals, scales, sizes){
  const t = d3.transition().duration(500);

  // Now draw the intervals
  const code_marginal_bars = g.selectAll('.code_marginal_bar')
    .data(marginals, d => d.code);

  // Exit
  code_marginal_bars.exit()
    .transition(t)
    .at({
      y: sizes.margin_count_h,
      height: 0,
    })
    .remove();

  // Append
  code_marginal_bars.enter()
    .append('rect.code_marginal_bar')
    .at({
       y: sizes.margin_count_h,
       x: d => scales.matrix_width_scale(d.code),
       fill: d => scales.code_to_color[d.code],
    })
    .merge(code_marginal_bars)
    .transition(t)
    .at({
      x: d => scales.matrix_width_scale(d.code),
      y: d => scales.marginal_y(d.count),
      width: scales.matrix_column_width,
      height: d => sizes.margin_count_h - scales.marginal_y(d.count),
    });

   // Axis
  const axis = g.selectAppend("g.code_marginal_bars_axis")
    .call(
      d3.axisLeft()
        .scale(scales.marginal_y)
        .ticks(5)
        .tickSizeOuter(0)
    );

  // Get rid of the zero tick value for cleanliness
  remove_zero_tick(axis);

  axis.selectAll("text")
    .at({
      y: -5,
      x: -4,
    });

}


//-------------------------------------------------------
// Functions for setting up interaction components
//-------------------------------------------------------

// Creates invisible bars across each pattern for event detection
function create_pattern_interaction_layer(g, patterns, scales, sizes, callbacks){
  g.html('');

  // Draws invisible selection rectangles over the horizontal patterns
  // That enable various interaction popups etc.
  const pattern_rows = g.selectAll('.pattern_row')
    .data(patterns)
    .enter().append('g.pattern_row')
    .attr('id', d => make_id_string(d, 'pattern'))
    .translate((d,i) => [-sizes.padding, scales.pattern_y(i)] )
    .selectAppend('rect')
      .classed('interaction_box', true)
      .at({
        width: sizes.w + 2*sizes.padding,
        height: scales.matrix_row_height,
      })
      .at(interaction_box_styles);

  // Apply desired callbacks
  Object.keys(callbacks).forEach(name => {
    pattern_rows.on(name, callbacks[name]);
  });
}

// Creates invisible vertical bars for each code for event detection
function create_code_interaction_layer(g, marginals, scales, sizes, callbacks){
  g.html('');

  // Draws invisible selection rectangles over the vertical patterns
  const code_cols = g.selectAll('.code_col')
    .data(marginals)
    .enter().append('g.code_col')
    .attr('id', d => make_id_string(d, 'code'))
    .translate((d,i) => [scales.matrix_width_scale(d.code), -sizes.padding])
    .selectAppend('rect')
      .classed('interaction_box', true)
      .at({
        width: scales.matrix_column_width,
        height: sizes.h + sizes.margin.bottom + sizes.padding
      })
      .at(interaction_box_styles);

  // Apply desired callbacks
  Object.keys(callbacks).forEach(name => {
    code_cols.on(name, callbacks[name]);
  });
}

// Appends a small slider the user can use to filter what the minimumn size of the cases they want is
function make_set_size_slider(g, set_size_x, sizes, starting_min_size, on_release){
  // How far we let the slider go in either direction
  const [range_min, range_max] = set_size_x.domain();

  // These are mutated to keep track of state of drag
  let desired_size = starting_min_size;
  let below_max = true;
  let above_min = true;

  const handle_w = 20;
  const handle_h = 17;
  const padding_top = 15;

  const default_handle_style = {
    strokeWidth: 1,
    stroke: 'rgba(0,0,0,0.5)'
  };
  const selected_handle_style = {
    strokeWidth: 2,
    stroke: 'rgba(0,0,0,1)'
  };

  // Setup handle container
  const handle = g.selectAppend('g.handle')
    .style('cursor', 'grab'); // Make cursor a hand to emphasize grabability of handle

  // Add a rectangle background
  const handle_rect = handle.selectAppend('rect')
    .at({
      width: handle_w,
      height: handle_h,
      fill: colors.silder_handle,
      fillOpacity: 0.6,
      rx: 7,
    });

  // Add vertical line marking exact cutoff position
  const handle_pointer = handle.selectAppend('line')
    .at({
      x1: handle_w/2,
      x2: handle_w/2,
      y1: -padding_top,
      y2: 0,
    })
    .at(default_handle_style);


  // Add text that shows value while dragging
  const handle_text = handle.selectAppend('text')
    .at({
      textAnchor: 'end',
      y: handle_h/2 + 2,
      x: -2,
      alignmentBaseline: 'middle',
      dominantBaseline: 'middle',
      opacity: 0,
    });

  // Function to move handle in x-direction
  const move_handle = x => handle.translate([x - handle_w/2, padding_top]);

  handle.call(
    d3.drag()
      .on("start", dragstarted)
      .on("drag",dragged)
      .on("end", dragended)
  );

  function dragstarted(d) {
    // Put a outline around handle to show it was selected
    handle_rect.at(selected_handle_style);
    handle_pointer.at(selected_handle_style);

    // Show the min-size text for precision changing
    handle_text.attr('opacity', 1);
  }

  function dragged(d) {
    desired_size = set_size_x.invert(d3.event.x);
    below_max = desired_size < range_max;
    above_min = desired_size > range_min;

    if(below_max && above_min){
      move_handle(d3.event.x);
      handle_text.text(`size > ${countFormat(desired_size)}`);
    }else {
      desired_size = !above_min ? range_min : range_max;
    }
  }

  function dragended(d) {
    // Reset outline of handle
    handle_rect.at(default_handle_style);
    handle_pointer.at(default_handle_style);

    // Hide text again
    handle_text.attr('opacity', 0);

    const new_desired_size = set_size_x.invert(d3.event.x);
    on_release(desired_size);
  }

  // Initialize handle position
  move_handle(set_size_x(starting_min_size));
}

// Creates a panel that can display text wherever it is placed
// Returns methods to update, show, and hide info
function create_info_panel(g, panel_size, side = 'left'){
  const width = panel_size[0];
  const panel = g.selectAppend('g.info');

  let text_x = width/2,
      font_size = '24px',
      text_anchor = 'middle';

  if(width > 300){
    // Very big
    // No changes to defaults
  } else if (width > 200){
    // Big
    font_size = '22px';
  } else if (width > 150){
    // Medium
    font_size = '20px';
  } else if (width > 100){
    // Small
    text_x = side == 'left' ? 0 : width;
    font_size = '18px';
    text_anchor =  side == 'left' ? 'start' : 'end';
  } else {
    // Tiny
    text_x = side == 'left' ? 0 : width;
    font_size = '15px';
    text_anchor = side == 'left' ? 'start' : 'end';
  }

  panel.selectAppend('rect')
    .at({
      width: panel_size[0],
      height: panel_size[1],
      fillOpacity: 0,
    });

  const panel_text = panel.selectAppend('text')
    .at({
      y: panel_size[1]/2,
      x: text_x,
    })
    .st({
      fontSize: font_size, // make font size's mildly responsive to try and avoid overlapping axis
      alignmentBaseline: 'middle',
      dominantBaseline: 'middle',
      textAnchor: text_anchor,
    });

  function update(content_array){
    panel_text.html(content_array);

    // If we have tspans make sure they are centered where they should be
    panel_text.selectAll('tspan')
      .attr('x', text_x);

    return this;
  }
  function hide(){
    panel.attr('opacity', 0);
    return this;
  }
  function show(){
    panel.attr('opacity', 1);
    return this;
  }

  // Start with panel hidden
  hide();

  return {
    update,
    hide,
    show,
  };
}


function draw_singleton_filter_toggle(g, starting_filtered, on_click){
  // Setup handle container
  const button_width = 11;
  const button_height = button_width * 1.75;
  const color_background = filtering => filtering ? 'forestgreen' : 'orangered';

  // First draw background of toggle
  const toggle_background = g.selectAppend('rect.toggle-background')
    .at({
      width: button_width*2,
      height: button_height,
      fill: color_background(starting_filtered),
      rx: 5,
      ry: 5,
    });

 const toggle_handle = g.selectAppend('g.toggle-handle');

 const toggle_handle_rect = toggle_handle.selectAppend('rect')
   .at({
     width: button_width ,
     height: button_height,
     fill: 'dimgrey',
     rx: 5,
     ry: 5
   });

 toggle_handle.selectAppend('line')
  .at({
    x2: button_width/2,
    x1: button_width/2,
    y2: 5,
    y1: button_height-5,
    stroke: 'white',
    strokeWidth: 1,
    opacity: 0.3,
  });

 g.selectAppend('text')
   .at({
     x: button_width * 2 + 5,
     y: button_height/2,
     dominantBaseline: 'middle',
     fontSize: "0.9rem",
   })
   .text('Hide single code patterns');

  g.on('click', on_click);

 function toggle_switch(filtering_singletons){
    toggle_handle
      .transition()
      .duration(200)
      .translate([
        filtering_singletons ? button_width : 0,
        0
      ]);

    toggle_background
      .transition()
      .duration(200)
      .attr('fill', color_background(filtering_singletons));
 }

 return {
   toggle: toggle_switch,
 };
}


function make_id_string(d, code_or_pattern){
  return `${code_or_pattern}_${d[code_or_pattern].replace(/\./g, '')}`;
}



// Helper functions for all visualizations

// Turn number into a given number of decimal places
function format_val(d, places = 3){
  return d3.format(`.${places}`)(d);
}

// number formatters
const countFormat = d3.format(",d");
const CiFormat = d3.format(".2f");
const pValFormat = d3.format("0.2");
const toPercent = d3.format(".1%");


// Compare two tuples as equal.
// E.g.
// tuples_equal([1,2], [1,2]) = true
// tuples_equal([1,2], [1,1]) = false
function tuples_equal(a, b){
  return (a[0] === b[0]) && (a[1] === b[1]);
}

function arrays_equal(arr_1, arr_2){
  // If vecs are different lengths data must different
  if(arr_1.length !== arr_1.length)
    return false;

  // If the union of the two arrays is the same size as both they're the same.
  const size_of_union = unique([...arr_1, ...arr_2]).length;
  return (size_of_union === arr_1.length) && (size_of_union === arr_2.length);
}


// Get unique set of values in an array
function unique(data){
  return d3.set(data).values();
};


// Takes a d3 selection of an SVG and downloads a svg for user
function downloadPlot(svg){
  const svgData = svg.node().outerHTML;
  const svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "phecode_network.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}


// Function to send a message back to shiny
function send_to_shiny(type, payload, destination){
  // Build message
  const message_body = {
    type: type,
    // append the date to the begining so sent value always changes.
    payload: [Date.now().toString(), ...payload]
  };

  // Make sure shiny is available before sending message
  if(typeof Shiny !== 'undefined'){
    // Send message off to server
    Shiny.onInputChange(destination, message_body);
  }
}

function setup_tooltip(dom_target, fields_to_show = ['code','OR']){

  // Modify logic here.

  const tooltip = dom_target.selectAppend('div.tooltip')
    .st({
      background:'rgba(255,255,255,0.8)',
      position:'absolute',
      padding: '0.25rem',
      fontSize: 18,
      border: '1px solid grey',
      borderRadius: '5px'
    });

  const santatize_key = key => key.replace('_', ' ');

  const santatize_value = val => typeof(val) === 'number' ? format_val(val): val;


  const show = function(d, mouse_event){
    // By filtering I avoid errors caused by not having data for something
    const table_body = Object.keys(d)
      .filter(key => fields_to_show.includes(key))
      .sort((a,b) => a == 'code' ? -1 : 1) // trick to make sure code field shows up first
      .reduce((table, key) =>
        table + `<tr>
                  <td style='text-align:right'>${santatize_key(key)}</td>
                  <td style='text-align:left; padding-left: 1rem'>${santatize_value(d[key])}</td>
                </tr>`, '');

      const tooltip_content = `<table> ${table_body} </table>`;

      const parent = tooltip.parent();

      // Prefer the style width over the attr but take attr if style isn't available.
      const parent_width = +parent.style('width').replace('px', '') ||  +parent.attr('width');
      const parent_height = +parent.style('height').replace('px', '') || +parent.attr('height');

      const [event_x, event_y] = d3.clientPoint(tooltip.parent().node(), mouse_event);

      const on_left_half = event_x < parent_width/2;
      const on_upper_half = event_y < parent_height/2;

      const offset = 5;

      const style_positioning = {
         display: 'block',
       };

      if(on_left_half){
        style_positioning.left = event_x + offset;
        style_positioning.right = 'auto';
      } else {
        style_positioning.right = parent_width - event_x + 2*offset;
        style_positioning.left = 'auto';
      }

      if(on_upper_half){
        style_positioning.top = event_y + offset;
        style_positioning.bottom = 'auto';
      } else {
        style_positioning.bottom = parent_height - event_y + 2*offset;
        style_positioning.top = 'auto';
      }


      //debugger;
      tooltip
       .st(style_positioning)
       .html(tooltip_content);
  };

  const hide = function(){
    tooltip
      .st({
        left: 0,
        top: 0,
        display: 'none',
      });
  };

  // Start tooltip hidden.
  hide();

  return {show, hide}
}


function refine(collection, path){
  // Walk down path into object to find value desired
  return path.reduce(
    function(refinement, element){
      try {
        return refinement[element];
      } catch (ignore) {}
    },
    collection
  );
}

function by(...keys){
  const paths = keys.map(
    function(element){
      return element.toString().split(".");
    }
  );

  // Compare each pair of values until finding a mismatch
  // if no mismatch, then items are equal.
  return function compare(first, second){
    // These hold the first value that differs between
    // the first and second object
    let first_value;
    let second_value;

    // Walks down path until we find where the two
    // objects differ from eachother. If none do, then
    // we just return as objects are essentially same.
    const all_values_equal = paths.every(function(path){
      first_value = refine(first, path);
      second_value = refine(second, path);
      return first_value === second_value;
    });

    if (all_values_equal){
      return 0;
    }

    return(
      (
        typeof first_value === typeof second_value
        ? first_value < second_value
        : typeof first_value < typeof second_value
      )
      ? -1
      : 1
    );
  }
}
