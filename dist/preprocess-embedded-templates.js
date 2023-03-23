"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const magic_string_1 = __importDefault(require("magic-string"));
const path_1 = __importDefault(require("path"));
const parse_static_imports_1 = __importDefault(require("parse-static-imports"));
const line_column_1 = __importDefault(require("line-column"));
const debug_1 = require("./debug");
const parse_templates_1 = require("./parse-templates");
function getMatchStartAndEnd(match) {
    return {
        start: debug_1.expect(match.index, 'Expected regular expression match to have an index'),
        end: debug_1.expect(match.index, 'Expected regular expression match to have an index') + match[0].length,
    };
}
function findImportedName(template, importPath, importIdentifier) {
    for (const $import of parse_static_imports_1.default(template)) {
        if ($import.moduleName === importPath) {
            const match = $import.namedImports.find(({ name }) => name === importIdentifier);
            return (match === null || match === void 0 ? void 0 : match.alias) || (match === null || match === void 0 ? void 0 : match.name);
        }
    }
    return undefined;
}
function replacementFrom(template, index, oldLength, newLength, type) {
    const loc = debug_1.expect(line_column_1.default(template).fromIndex(index), 'BUG: expected to find a line/column based on index');
    return {
        type,
        index,
        oldLength,
        newLength,
        originalCol: loc.col,
        originalLine: loc.line,
    };
}
function loadGetTemplateLocals(path, exportPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const templateLocals = require(path);
    let getTemplateLocals = templateLocals;
    for (const segment of exportPath.split('.')) {
        getTemplateLocals = getTemplateLocals[segment];
    }
    return getTemplateLocals;
}
function replaceMatch(s, match, startReplacement, endReplacement, template, getTemplateLocals, includeTemplateTokens) {
    const { start: openStart, end: openEnd } = getMatchStartAndEnd(match.start);
    const { start: closeStart, end: closeEnd } = getMatchStartAndEnd(match.end);
    let options = '';
    if (includeTemplateTokens) {
        const tokensString = getTemplateLocals(template.slice(openEnd, closeStart))
            .filter((local) => local.match(/^[$A-Z_][0-9A-Z_$]*$/i))
            .join(',');
        if (tokensString.length > 0) {
            options = `, { scope() { return {${tokensString}}; } }`;
        }
    }
    const newStart = `${startReplacement}\``;
    const newEnd = `\`${options}${endReplacement}`;
    s.overwrite(openStart, openEnd, newStart);
    s.overwrite(closeStart, closeEnd, newEnd);
    return [
        replacementFrom(template, openStart, openEnd - openStart, newStart.length, 'start'),
        replacementFrom(template, closeStart, closeEnd - closeStart, newEnd.length, 'end'),
    ];
}
/**
 * Preprocesses all embedded templates within a JavaScript or TypeScript file.
 * This function replaces all embedded templates that match our template syntax
 * with valid, parseable JS. Optionally, it can also include a source map, and
 * it can also include all possible values used within the template.
 *
 * Input:
 *
 *   <template><MyComponent/><template>
 *
 * Output:
 *
 *   [GLIMMER_TEMPLATE(`<MyComponent/>`, { scope() { return {MyComponent}; } })];
 *
 * It can also be used with template literals to provide the in scope values:
 *
 * Input:
 *
 *   hbs`<MyComponent/>`;
 *
 * Output
 *
 *   hbs(`<MyComponent/>`, { scope() { return {MyComponent}; } });
 */
function preprocessEmbeddedTemplates(template, options) {
    let getTemplateLocals;
    const { importPath, templateTag, templateTagReplacement, includeSourceMaps, includeTemplateTokens, relativePath, } = options;
    let { importIdentifier } = options;
    if ('getTemplateLocals' in options) {
        getTemplateLocals = options.getTemplateLocals;
    }
    else {
        getTemplateLocals = loadGetTemplateLocals(options.getTemplateLocalsRequirePath, options.getTemplateLocalsExportPath);
    }
    if (importPath && importIdentifier) {
        importIdentifier = findImportedName(template, importPath, importIdentifier);
        if (!importIdentifier) {
            return {
                output: template,
                replacements: [],
            };
        }
    }
    const matches = parse_templates_1.parseTemplates(template, relativePath, templateTag);
    const replacements = [];
    const s = new magic_string_1.default(template);
    for (const match of matches) {
        if (match.type === 'template-literal' && match.tagName === importIdentifier) {
            replacements.push(...replaceMatch(s, match, `${match.tagName}(`, ')', template, getTemplateLocals, includeTemplateTokens));
        }
        else if (match.type === 'template-tag') {
            replacements.push(...replaceMatch(s, match, `[${templateTagReplacement}(`, ')]', template, getTemplateLocals, includeTemplateTokens));
        }
    }
    let output = s.toString();
    if (includeSourceMaps) {
        const { dir, name } = path_1.default.parse(relativePath);
        const map = s.generateMap({
            file: `${dir}/${name}.js`,
            source: relativePath,
            includeContent: true,
            hires: true,
        });
        output += `\n//# sourceMappingURL=${map.toUrl()}`;
    }
    return {
        output,
        replacements,
    };
}
exports.default = preprocessEmbeddedTemplates;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlcHJvY2Vzcy1lbWJlZGRlZC10ZW1wbGF0ZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcHJlcHJvY2Vzcy1lbWJlZGRlZC10ZW1wbGF0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnRUFBdUM7QUFDdkMsZ0RBQXdCO0FBQ3hCLGdGQUFzRDtBQUN0RCw4REFBcUM7QUFDckMsbUNBQWlDO0FBQ2pDLHVEQUFrRTtBQStDbEUsU0FBUyxtQkFBbUIsQ0FBQyxLQUF1QjtJQUNsRCxPQUFPO1FBQ0wsS0FBSyxFQUFFLGNBQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLG9EQUFvRCxDQUFDO1FBQ2hGLEdBQUcsRUFDRCxjQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxvREFBb0QsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNO0tBQzlGLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FDdkIsUUFBZ0IsRUFDaEIsVUFBa0IsRUFDbEIsZ0JBQXdCO0lBRXhCLEtBQUssTUFBTSxPQUFPLElBQUksOEJBQWtCLENBQUMsUUFBUSxDQUFDLEVBQUU7UUFDbEQsSUFBSSxPQUFPLENBQUMsVUFBVSxLQUFLLFVBQVUsRUFBRTtZQUNyQyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO1lBRWpGLE9BQU8sQ0FBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsS0FBSyxNQUFJLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxJQUFJLENBQUEsQ0FBQztTQUNwQztLQUNGO0lBRUQsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUN0QixRQUFnQixFQUNoQixLQUFhLEVBQ2IsU0FBaUIsRUFD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LElBQUksc0JBQXNCLEdBQUcsRUFDN0IsSUFBSSxFQUNKLFFBQVEsRUFDUixpQkFBaUIsRUFDakIscUJBQXFCLENBQ3RCLENBQ0YsQ0FBQztTQUNIO0tBQ0Y7SUFFRCxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFFMUIsSUFBSSxpQkFBaUIsRUFBRTtRQUNyQixNQUFNLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLGNBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFL0MsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQztZQUN4QixJQUFJLEVBQUUsR0FBRyxHQUFHLElBQUksSUFBSSxLQUFLO1lBQ3pCLE1BQU0sRUFBRSxZQUFZO1lBQ3BCLGNBQWMsRUFBRSxJQUFJO1lBQ3BCLEtBQUssRUFBRSxJQUFJO1NBQ1osQ0FBQyxDQUFDO1FBRUgsTUFBTSxJQUFJLDBCQUEwQixHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztLQUNuRDtJQUVELE9BQU87UUFDTCxNQUFNO1FBQ04sWUFBWTtLQUNiLENBQUM7QUFDSixDQUFDO0FBeEZELDhDQXdGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBNYWdpY1N0cmluZyBmcm9tICdtYWdpYy1zdHJpbmcnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgcGFyc2VTdGF0aWNJbXBvcnRzIGZyb20gJ3BhcnNlLXN0YXRpYy1pbXBvcnRzJztcbmltcG9ydCBsaW5lQ29sdW1uIGZyb20gJ2xpbmUtY29sdW1uJztcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJy4vZGVidWcnO1xuaW1wb3J0IHsgcGFyc2VUZW1wbGF0ZXMsIFRlbXBsYXRlTWF0Y2ggfSBmcm9tICcuL3BhcnNlLXRlbXBsYXRlcyc7XG5cbmludGVyZmFjZSBQcmVwcm9jZXNzT3B0aW9uc0VhZ2VyIHtcbiAgZ2V0VGVtcGxhdGVMb2NhbHM6IEdldFRlbXBsYXRlTG9jYWxzO1xuXG4gIGltcG9ydElkZW50aWZpZXI/OiBzdHJpbmc7XG4gIGltcG9ydFBhdGg/OiBzdHJpbmc7XG4gIHRlbXBsYXRlVGFnPzogc3RyaW5nO1xuICB0ZW1wbGF0ZVRhZ1JlcGxhY2VtZW50Pzogc3RyaW5nO1xuXG4gIHJlbGF0aXZlUGF0aDogc3RyaW5nO1xuICBpbmNsdWRlU291cmNlTWFwczogYm9vbGVhbjtcbiAgaW5jbHVkZVRlbXBsYXRlVG9rZW5zOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgUHJlcHJvY2Vzc09wdGlvbnNMYXp5IHtcbiAgZ2V0VGVtcGxhdGVMb2NhbHNSZXF1aXJlUGF0aDogc3RyaW5nO1xuICBnZXRUZW1wbGF0ZUxvY2Fsc0V4cG9ydFBhdGg6IHN0cmluZztcblxuICBpbXBvcnRJZGVudGlmaWVyPzogc3RyaW5nO1xuICBpbXBvcnRQYXRoPzogc3RyaW5nO1xuICB0ZW1wbGF0ZVRhZz86IHN0cmluZztcbiAgdGVtcGxhdGVUYWdSZXBsYWNlbWVudD86IHN0cmluZztcblxuICByZWxhdGl2ZVBhdGg6IHN0cmluZztcbiAgaW5jbHVkZVNvdXJjZU1hcHM6IGJvb2xlYW47XG4gIGluY2x1ZGVUZW1wbGF0ZVRva2VuczogYm9vbGVhbjtcbn1cblxudHlwZSBQcmVwcm9jZXNzT3B0aW9ucyA9IFByZXByb2Nlc3NPcHRpb25zTGF6eSB8IFByZXByb2Nlc3NPcHRpb25zRWFnZXI7XG5cbmludGVyZmFjZSBQcmVwcm9jZXNzZWRPdXRwdXQge1xuICBvdXRwdXQ6IHN0cmluZztcbiAgcmVwbGFjZW1lbnRzOiBSZXBsYWNlbWVudFtdO1xufVxuXG5pbnRlcmZhY2UgUmVwbGFjZW1lbnQge1xuICB0eXBlOiAnc3RhcnQnIHwgJ2VuZCc7XG4gIGluZGV4OiBudW1iZXI7XG4gIG9sZExlbmd0aDogbnVtYmVyO1xuICBuZXdMZW5ndGg6IG51bWJlcjtcbiAgb3JpZ2luYWxMaW5lOiBudW1iZXI7XG4gIG9yaWdpbmFsQ29sOiBudW1iZXI7XG59XG5cbnR5cGUgR2V0VGVtcGxhdGVMb2NhbHMgPSAodGVtcGxhdGU6IHN0cmluZykgPT4gc3RyaW5nW107XG5cbmZ1bmN0aW9uIGdldE1hdGNoU3RhcnRBbmRFbmQobWF0Y2g6IFJlZ0V4cE1hdGNoQXJyYXkpIHtcbiAgcmV0dXJuIHtcbiAgICBzdGFydDogZXhwZWN0KG1hdGNoLmluZGV4LCAnRXhwZWN0ZWQgcmVndWxhciBleHByZXNzaW9uIG1hdGNoIHRvIGhhdmUgYW4gaW5kZXgnKSxcbiAgICBlbmQ6XG4gICAgICBleHBlY3QobWF0Y2guaW5kZXgsICdFeHBlY3RlZCByZWd1bGFyIGV4cHJlc3Npb24gbWF0Y2ggdG8gaGF2ZSBhbiBpbmRleCcpICsgbWF0Y2hbMF0ubGVuZ3RoLFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaW5kSW1wb3J0ZWROYW1lKFxuICB0ZW1wbGF0ZTogc3RyaW5nLFxuICBpbXBvcnRQYXRoOiBzdHJpbmcsXG4gIGltcG9ydElkZW50aWZpZXI6IHN0cmluZ1xuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgZm9yIChjb25zdCAkaW1wb3J0IG9mIHBhcnNlU3RhdGljSW1wb3J0cyh0ZW1wbGF0ZSkpIHtcbiAgICBpZiAoJGltcG9ydC5tb2R1bGVOYW1lID09PSBpbXBvcnRQYXRoKSB7XG4gICAgICBjb25zdCBtYXRjaCA9ICRpbXBvcnQubmFtZWRJbXBvcnRzLmZpbmQoKHsgbmFtZSB9KSA9PiBuYW1lID09PSBpbXBvcnRJZGVudGlmaWVyKTtcblxuICAgICAgcmV0dXJuIG1hdGNoPy5hbGlhcyB8fCBtYXRjaD8ubmFtZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlbWVudEZyb20oXG4gIHRlbXBsYXRlOiBzdHJpbmcsXG4gIGluZGV4OiBudW1iZXIsXG4gIG9sZExlbmd0aDogbnVtYmVyLFxuICBuZXdMZW5ndGg6IG51bWJlcixcbiAgdHlwZTogJ3N0YXJ0JyB8ICdlbmQnXG4pOiBSZXBsYWNlbWVudCB7XG4gIGNvbnN0IGxvYyA9IGV4cGVjdChcbiAgICBsaW5lQ29sdW1uKHRlbXBsYXRlKS5mcm9tSW5kZXgoaW5kZXgpLFxuICAgICdCVUc6IGV4cGVjdGVkIHRvIGZpbmQgYSBsaW5lL2NvbHVtbiBiYXNlZCBvbiBpbmRleCdcbiAgKTtcblxuICByZXR1cm4ge1xuICAgIHR5cGUsXG4gICAgaW5kZXgsXG4gICAgb2xkTGVuZ3RoLFxuICAgIG5ld0xlbmd0aCxcbiAgICBvcmlnaW5hbENvbDogbG9jLmNvbCxcbiAgICBvcmlnaW5hbExpbmU6IGxvYy5saW5lLFxuICB9O1xufVxuXG5mdW5jdGlvbiBsb2FkR2V0VGVtcGxhdGVMb2NhbHMocGF0aDogc3RyaW5nLCBleHBvcnRQYXRoOiBzdHJpbmcpOiBHZXRUZW1wbGF0ZUxvY2FscyB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdmFyLXJlcXVpcmVzXG4gIGNvbnN0IHRlbXBsYXRlTG9jYWxzID0gcmVxdWlyZShwYXRoKTtcblxuICBsZXQgZ2V0VGVtcGxhdGVMb2NhbHMgPSB0ZW1wbGF0ZUxvY2FscztcblxuICBmb3IgKGNvbnN0IHNlZ21lbnQgb2YgZXhwb3J0UGF0aC5zcGxpdCgnLicpKSB7XG4gICAgZ2V0VGVtcGxhdGVMb2NhbHMgPSBnZXRUZW1wbGF0ZUxvY2Fsc1tzZWdtZW50XTtcbiAgfVxuXG4gIHJldHVybiBnZXRUZW1wbGF0ZUxvY2Fscztcbn1cblxuZnVuY3Rpb24gcmVwbGFjZU1hdGNoKFxuICBzOiBNYWdpY1N0cmluZyxcbiAgbWF0Y2g6IFRlbXBsYXRlTWF0Y2gsXG4gIHN0YXJ0UmVwbGFjZW1lbnQ6IHN0cmluZyxcbiAgZW5kUmVwbGFjZW1lbnQ6IHN0cmluZyxcbiAgdGVtcGxhdGU6IHN0cmluZyxcbiAgZ2V0VGVtcGxhdGVMb2NhbHM6IEdldFRlbXBsYXRlTG9jYWxzLFxuICBpbmNsdWRlVGVtcGxhdGVUb2tlbnM6IGJvb2xlYW5cbik6IFJlcGxhY2VtZW50W10ge1xuICBjb25zdCB7IHN0YXJ0OiBvcGVuU3RhcnQsIGVuZDogb3BlbkVuZCB9ID0gZ2V0TWF0Y2hTdGFydEFuZEVuZChtYXRjaC5zdGFydCk7XG4gIGNvbnN0IHsgc3RhcnQ6IGNsb3NlU3RhcnQsIGVuZDogY2xvc2VFbmQgfSA9IGdldE1hdGNoU3RhcnRBbmRFbmQobWF0Y2guZW5kKTtcblxuICBsZXQgb3B0aW9ucyA9ICcnO1xuXG4gIGlmIChpbmNsdWRlVGVtcGxhdGVUb2tlbnMpIHtcbiAgICBjb25zdCB0b2tlbnNTdHJpbmcgPSBnZXRUZW1wbGF0ZUxvY2Fscyh0ZW1wbGF0ZS5zbGljZShvcGVuRW5kLCBjbG9zZVN0YXJ0KSlcbiAgICAgIC5maWx0ZXIoKGxvY2FsOiBzdHJpbmcpID0+IGxvY2FsLm1hdGNoKC9eWyRBLVpfXVswLTlBLVpfJF0qJC9pKSlcbiAgICAgIC5qb2luKCcsJyk7XG5cbiAgICBpZiAodG9rZW5zU3RyaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIG9wdGlvbnMgPSBgLCB7IHNjb3BlKCkgeyByZXR1cm4geyR7dG9rZW5zU3RyaW5nfX07IH0gfWA7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbmV3U3RhcnQgPSBgJHtzdGFydFJlcGxhY2VtZW50fVxcYGA7XG4gIGNvbnN0IG5ld0VuZCA9IGBcXGAke29wdGlvbnN9JHtlbmRSZXBsYWNlbWVudH1gO1xuXG4gIHMub3ZlcndyaXRlKG9wZW5TdGFydCwgb3BlbkVuZCwgbmV3U3RhcnQpO1xuICBzLm92ZXJ3cml0ZShjbG9zZVN0YXJ0LCBjbG9zZUVuZCwgbmV3RW5kKTtcblxuICByZXR1cm4gW1xuICAgIHJlcGxhY2VtZW50RnJvbSh0ZW1wbGF0ZSwgb3BlblN0YXJ0LCBvcGVuRW5kIC0gb3BlblN0YXJ0LCBuZXdTdGFydC5sZW5ndGgsICdzdGFydCcpLFxuICAgIHJlcGxhY2VtZW50RnJvbSh0ZW1wbGF0ZSwgY2xvc2VTdGFydCwgY2xvc2VFbmQgLSBjbG9zZVN0YXJ0LCBuZXdFbmQubGVuZ3RoLCAnZW5kJyksXG4gIF07XG59XG5cbi8qKlxuICogUHJlcHJvY2Vzc2VzIGFsbCBlbWJlZGRlZCB0ZW1wbGF0ZXMgd2l0aGluIGEgSmF2YVNjcmlwdCBvciBUeXBlU2NyaXB0IGZpbGUuXG4gKiBUaGlzIGZ1bmN0aW9uIHJlcGxhY2VzIGFsbCBlbWJlZGRlZCB0ZW1wbGF0ZXMgdGhhdCBtYXRjaCBvdXIgdGVtcGxhdGUgc3ludGF4XG4gKiB3aXRoIHZhbGlkLCBwYXJzZWFibGUgSlMuIE9wdGlvbmFsbHksIGl0IGNhbiBhbHNvIGluY2x1ZGUgYSBzb3VyY2UgbWFwLCBhbmRcbiAqIGl0IGNhbiBhbHNvIGluY2x1ZGUgYWxsIHBvc3NpYmxlIHZhbHVlcyB1c2VkIHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gKlxuICogSW5wdXQ6XG4gKlxuICogICA8dGVtcGxhdGU+PE15Q29tcG9uZW50Lz48dGVtcGxhdGU+XG4gKlxuICogT3V0cHV0OlxuICpcbiAqICAgW0dMSU1NRVJfVEVNUExBVEUoYDxNeUNvbXBvbmVudC8+YCwgeyBzY29wZSgpIHsgcmV0dXJuIHtNeUNvbXBvbmVudH07IH0gfSldO1xuICpcbiAqIEl0IGNhbiBhbHNvIGJlIHVzZWQgd2l0aCB0ZW1wbGF0ZSBsaXRlcmFscyB0byBwcm92aWRlIHRoZSBpbiBzY29wZSB2YWx1ZXM6XG4gKlxuICogSW5wdXQ6XG4gKlxuICogICBoYnNgPE15Q29tcG9uZW50Lz5gO1xuICpcbiAqIE91dHB1dFxuICpcbiAqICAgaGJzKGA8TXlDb21wb25lbnQvPmAsIHsgc2NvcGUoKSB7IHJldHVybiB7TXlDb21wb25lbnR9OyB9IH0pO1xuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcmVwcm9jZXNzRW1iZWRkZWRUZW1wbGF0ZXMoXG4gIHRlbXBsYXRlOiBzdHJpbmcsXG4gIG9wdGlvbnM6IFByZXByb2Nlc3NPcHRpb25zXG4pOiBQcmVwcm9jZXNzZWRPdXRwdXQge1xuICBsZXQgZ2V0VGVtcGxhdGVMb2NhbHM6IEdldFRlbXBsYXRlTG9jYWxzO1xuXG4gIGNvbnN0IHtcbiAgICBpbXBvcnRQYXRoLFxuICAgIHRlbXBsYXRlVGFnLFxuICAgIHRlbXBsYXRlVGFnUmVwbGFjZW1lbnQsXG4gICAgaW5jbHVkZVNvdXJjZU1hcHMsXG4gICAgaW5jbHVkZVRlbXBsYXRlVG9rZW5zLFxuICAgIHJlbGF0aXZlUGF0aCxcbiAgfSA9IG9wdGlvbnM7XG5cbiAgbGV0IHsgaW1wb3J0SWRlbnRpZmllciB9ID0gb3B0aW9ucztcblxuICBpZiAoJ2dldFRlbXBsYXRlTG9jYWxzJyBpbiBvcHRpb25zKSB7XG4gICAgZ2V0VGVtcGxhdGVMb2NhbHMgPSBvcHRpb25zLmdldFRlbXBsYXRlTG9jYWxzO1xuICB9IGVsc2Uge1xuICAgIGdldFRlbXBsYXRlTG9jYWxzID0gbG9hZEdldFRlbXBsYXRlTG9jYWxzKFxuICAgICAgb3B0aW9ucy5nZXRUZW1wbGF0ZUxvY2Fsc1JlcXVpcmVQYXRoLFxuICAgICAgb3B0aW9ucy5nZXRUZW1wbGF0ZUxvY2Fsc0V4cG9ydFBhdGhcbiAgICApO1xuICB9XG5cbiAgaWYgKGltcG9ydFBhdGggJiYgaW1wb3J0SWRlbnRpZmllcikge1xuICAgIGltcG9ydElkZW50aWZpZXIgPSBmaW5kSW1wb3J0ZWROYW1lKHRlbXBsYXRlLCBpbXBvcnRQYXRoLCBpbXBvcnRJZGVudGlmaWVyKTtcblxuICAgIGlmICghaW1wb3J0SWRlbnRpZmllcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb3V0cHV0OiB0ZW1wbGF0ZSxcbiAgICAgICAgcmVwbGFjZW1lbnRzOiBbXSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbWF0Y2hlcyA9IHBhcnNlVGVtcGxhdGVzKHRlbXBsYXRlLCByZWxhdGl2ZVBhdGgsIHRlbXBsYXRlVGFnKTtcbiAgY29uc3QgcmVwbGFjZW1lbnRzOiBSZXBsYWNlbWVudFtdID0gW107XG4gIGNvbnN0IHMgPSBuZXcgTWFnaWNTdHJpbmcodGVtcGxhdGUpO1xuXG4gIGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuICAgIGlmIChtYXRjaC50eXBlID09PSAndGVtcGxhdGUtbGl0ZXJhbCcgJiYgbWF0Y2gudGFnTmFtZSA9PT0gaW1wb3J0SWRlbnRpZmllcikge1xuICAgICAgcmVwbGFjZW1lbnRzLnB1c2goXG4gICAgICAgIC4uLnJlcGxhY2VNYXRjaChcbiAgICAgICAgICBzLFxuICAgICAgICAgIG1hdGNoLFxuICAgICAgICAgIGAke21hdGNoLnRhZ05hbWV9KGAsXG4gICAgICAgICAgJyknLFxuICAgICAgICAgIHRlbXBsYXRlLFxuICAgICAgICAgIGdldFRlbXBsYXRlTG9jYWxzLFxuICAgICAgICAgIGluY2x1ZGVUZW1wbGF0ZVRva2Vuc1xuICAgICAgICApXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAobWF0Y2gudHlwZSA9PT0gJ3RlbXBsYXRlLXRhZycpIHtcbiAgICAgIHJlcGxhY2VtZW50cy5wdXNoKFxuICAgICAgICAuLi5yZXBsYWNlTWF0Y2goXG4gICAgICAgICAgcyxcbiAgICAgICAgICBtYXRjaCxcbiAgICAgICAgICBgWyR7dGVtcGxhdGVUYWdSZXBsYWNlbWVudH0oYCxcbiAgICAgICAgICAnKV0nLFxuICAgICAgICAgIHRlbXBsYXRlLFxuICAgICAgICAgIGdldFRlbXBsYXRlTG9jYWxzLFxuICAgICAgICAgIGluY2x1ZGVUZW1wbGF0ZVRva2Vuc1xuICAgICAgICApXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGxldCBvdXRwdXQgPSBzLnRvU3RyaW5nKCk7XG5cbiAgaWYgKGluY2x1ZGVTb3VyY2VNYXBzKSB7XG4gICAgY29uc3QgeyBkaXIsIG5hbWUgfSA9IHBhdGgucGFyc2UocmVsYXRpdmVQYXRoKTtcblxuICAgIGNvbnN0IG1hcCA9IHMuZ2VuZXJhdGVNYXAoe1xuICAgICAgZmlsZTogYCR7ZGlyfS8ke25hbWV9LmpzYCxcbiAgICAgIHNvdXJjZTogcmVsYXRpdmVQYXRoLFxuICAgICAgaW5jbHVkZUNvbnRlbnQ6IHRydWUsXG4gICAgICBoaXJlczogdHJ1ZSxcbiAgICB9KTtcblxuICAgIG91dHB1dCArPSBgXFxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9JHttYXAudG9VcmwoKX1gO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBvdXRwdXQsXG4gICAgcmVwbGFjZW1lbnRzLFxuICB9O1xufVxuIl19