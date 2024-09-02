module.exports = {
    hooks: {
        readPackage: (pkg) => {
            // biome-ignore lint/performance/noDelete:
            delete pkg.optionalDependencies.canvas;
            return pkg;
        },
    },
};
