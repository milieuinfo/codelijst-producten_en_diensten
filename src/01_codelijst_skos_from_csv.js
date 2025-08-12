'use strict';
import { generate_skos } from 'maven-metadata-generator-npm';
import {
    turtlePath,
    jsonldOptions,
    ntriplesPath,
    csvOptions
} from './utils/variables.js';

generate_skos(turtlePath, jsonldOptions, ntriplesPath, csvOptions);

